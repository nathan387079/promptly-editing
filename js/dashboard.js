import { auth, db } from "./firebase.js";
import { getIdTokenResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  addDoc, collection, collectionGroup, doc, getDoc, getDocs, limit,
  orderBy, query, serverTimestamp, setDoc, updateDoc, where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const roleNames = {
  personal: "Personal", student: "Student", teacher: "Teacher",
  "school-administrator": "School administrator", "site-administrator": "Site administrator",
  moderator: "Moderator", "support-team": "Support team"
};
let user = null;
let claims = {};

function message(text, type = "error") {
  const element = $("dashboard-message");
  element.textContent = text;
  element.className = `notice${type === "success" ? " success" : ""}`;
  element.hidden = !text;
}

function show(id) { $(id).hidden = false; }
function safeText(value, fallback = "") { return typeof value === "string" ? value : fallback; }

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function emptyCard(text) {
  const card = element("article", "card", text);
  return card;
}

function renderClassCard(classId, data, options = {}) {
  const card = element("article", "card class-card");
  const title = element("h3", "", safeText(data.name, "Classroom"));
  const school = safeText(data.schoolName || data.schoolId, "Independent classroom");
  card.append(title, element("p", "", school));
  if (options.showCode) {
    const code = element("span", "class-code", classId);
    code.title = "Share this code with your students";
    card.append(element("p", "", "Class code (share with students):"), code);
  }
  if (options.memberCount !== undefined) card.append(element("p", "", `${options.memberCount} ${options.memberCount === 1 ? "student" : "students"}`));
  if (options.studentView) {
    const assignments = options.assignments || [];
    const assignmentList = element("div", "assignment-list");
    if (!assignments.length) assignmentList.append(element("p", "", "No assignments yet."));
    for (const assignment of assignments) assignmentList.append(renderStudentAssignment(classId, assignment));
    card.append(assignmentList);
  }
  return card;
}

function renderStudentAssignment(classId, assignment) {
  const wrapper = element("article", "assignment-item");
  wrapper.append(element("h4", "", safeText(assignment.data.title, "Writing assignment")));
  wrapper.append(element("p", "", safeText(assignment.data.prompt)));
  if (assignment.data.dueDate) wrapper.append(element("p", "", `Due ${assignment.data.dueDate}`));
  const form = document.createElement("form");
  form.className = "assignment-form";
  const textarea = document.createElement("textarea");
  textarea.required = true;
  textarea.maxLength = 10000;
  textarea.placeholder = "Write your response…";
  textarea.setAttribute("aria-label", `Response to ${safeText(assignment.data.title, "writing assignment")}`);
  const button = element("button", "", "Submit response");
  const status = element("p", "");
  if (assignment.submission) {
    textarea.value = safeText(assignment.submission.response);
    textarea.disabled = true;
    button.disabled = true;
    button.textContent = "Submitted";
    status.textContent = "Your response is saved.";
  }
  form.append(textarea, button, status);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = textarea.value.trim();
    if (response.length < 30) { status.textContent = "Please write at least 30 characters."; return; }
    button.disabled = true;
    status.textContent = "Saving…";
    try {
      await setDoc(doc(db, "classrooms", classId, "assignments", assignment.id, "submissions", user.uid), {
        uid: user.uid, name: user.displayName || user.email || "Student", response,
        submittedAt: serverTimestamp()
      });
      textarea.disabled = true;
      button.textContent = "Submitted";
      status.textContent = "Your response is saved.";
    } catch {
      button.disabled = false;
      status.textContent = "Couldn't save your response. Please try again.";
    }
  });
  wrapper.append(form);
  return wrapper;
}

async function loadPersonal() {
  show("personal-panel");
  $("membership-status").textContent = claims.premium === true ? "Premium" : "Free";
  try {
    const snapshots = await getDocs(collection(db, "users", user.uid, "responses"));
    const days = new Set(snapshots.docs.map((item) => item.id));
    $("writing-days").textContent = String(days.size);
    const date = new Date();
    const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!days.has(key(date))) date.setDate(date.getDate() - 1);
    let streak = 0;
    while (days.has(key(date))) { streak++; date.setDate(date.getDate() - 1); }
    $("writing-streak").textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
  } catch {
    $("writing-days").textContent = "Unavailable";
    $("writing-streak").textContent = "Unavailable";
    message("Your writing summary couldn't be loaded. Your saved writing is still available in My writing.");
  }
}

async function createClassroom(name) {
  const classId = crypto.randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase();
  const schoolId = safeText(claims.schoolId);
  const schoolName = schoolId ? await schoolDisplayName(schoolId) : "";
  await setDoc(doc(db, "classrooms", classId), {
    name, schoolId, schoolName, teacherUid: user.uid, createdAt: serverTimestamp()
  });
  return classId;
}

async function schoolDisplayName(schoolId) {
  try {
    const school = await getDoc(doc(db, "schools", schoolId));
    return school.exists() ? safeText(school.data().name) : "";
  } catch { return ""; }
}

function assignmentForm(classId) {
  const form = document.createElement("form");
  form.className = "assignment-form";
  const title = document.createElement("input");
  title.required = true; title.maxLength = 100; title.placeholder = "Assignment title";
  const prompt = document.createElement("textarea");
  prompt.required = true; prompt.maxLength = 2000; prompt.placeholder = "Prompt or instructions";
  const dueDate = document.createElement("input");
  dueDate.type = "date"; dueDate.setAttribute("aria-label", "Due date (optional)");
  const button = element("button", "", "Post assignment");
  const status = element("p", "");
  form.append(title, prompt, dueDate, button, status);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    try {
      await addDoc(collection(db, "classrooms", classId, "assignments"), {
        title: title.value.trim(), prompt: prompt.value.trim(), dueDate: dueDate.value,
        teacherUid: user.uid, schoolId: safeText(claims.schoolId), createdAt: serverTimestamp()
      });
      form.reset(); status.textContent = "Assignment posted."; status.className = "notice success";
      await loadTeacherClasses();
    } catch {
      status.textContent = "Couldn't post the assignment. Please try again.";
    } finally { button.disabled = false; }
  });
  return form;
}

async function loadTeacherClasses() {
  const container = $("teacher-classes");
  container.replaceChildren();
  try {
    const records = await getDocs(query(collection(db, "classrooms"), where("teacherUid", "==", user.uid)));
    if (records.empty) { container.append(emptyCard("Your classrooms will appear here.")); return; }
    for (const record of records.docs) {
      const data = record.data();
      const card = renderClassCard(record.id, data, { showCode: true });
      const [members, assignments] = await Promise.all([
        getDocs(collection(db, "classrooms", record.id, "members")),
        getDocs(query(collection(db, "classrooms", record.id, "assignments"), orderBy("createdAt", "desc")))
      ]);
      card.append(element("p", "", `${members.size} ${members.size === 1 ? "student" : "students"}`));
      card.append(element("h3", "", "Assignments"));
      const list = element("div", "assignment-list");
      if (assignments.empty) list.append(element("p", "", "Post a first writing assignment below."));
      for (const assignment of assignments.docs) {
        const item = element("article", "assignment-item");
        item.append(element("h4", "", safeText(assignment.data().title, "Writing assignment")));
        item.append(element("p", "", safeText(assignment.data().prompt)));
        const submissions = await getDocs(collection(db, "classrooms", record.id, "assignments", assignment.id, "submissions"));
        item.append(element("p", "", `${submissions.size} ${submissions.size === 1 ? "response" : "responses"}`));
        for (const submission of submissions.docs) {
          const work = element("article", "submission-item");
          work.append(element("strong", "", safeText(submission.data().name, "Student")));
          work.append(element("p", "", safeText(submission.data().response)));
          item.append(work);
        }
        list.append(item);
      }
      card.append(list, assignmentForm(record.id));
      container.append(card);
    }
  } catch {
    message("Your classroom data couldn't be loaded. Check that your teacher role is active and try again.");
  }
}

async function loadStudentClasses() {
  const container = $("student-classes");
  container.replaceChildren();
  try {
    const memberships = await getDocs(query(collectionGroup(db, "members"), where("uid", "==", user.uid)));
    if (memberships.empty) { container.append(emptyCard("You haven’t joined a classroom yet.")); return; }
    for (const membership of memberships.docs) {
      const classId = membership.ref.parent.parent.id;
      const classroom = await getDoc(doc(db, "classrooms", classId));
      if (!classroom.exists()) continue;
      const assignmentDocs = await getDocs(query(collection(db, "classrooms", classId, "assignments"), orderBy("createdAt", "desc")));
      const assignments = [];
      for (const assignment of assignmentDocs.docs) {
        const submission = await getDoc(doc(db, "classrooms", classId, "assignments", assignment.id, "submissions", user.uid));
        assignments.push({ id: assignment.id, data: assignment.data(), submission: submission.exists() ? submission.data() : null });
      }
      container.append(renderClassCard(classId, classroom.data(), { studentView: true, assignments }));
    }
  } catch {
    message("Your classroom assignments couldn't be loaded. Please try again.");
  }
}

async function loadSchoolDashboard() {
  const schoolId = safeText(claims.schoolId);
  if (!schoolId) { message("Your school administrator account needs a school ID claim before it can manage a school."); return; }
  try {
    const school = await getDoc(doc(db, "schools", schoolId));
    if (!school.exists()) { $("school-summary").textContent = "This school hasn't been created yet. Ask a site administrator to set it up."; return; }
    const data = school.data();
    $("school-heading").textContent = safeText(data.name, "School dashboard");
    $("school-summary").textContent = "Update the school name and review classrooms in your school.";
    $("school-name").value = safeText(data.name);
    $("school-form").hidden = false;
    const classes = await getDocs(query(collection(db, "classrooms"), where("schoolId", "==", schoolId)));
    if (classes.empty) $("school-classes").append(emptyCard("No classrooms have been created yet."));
    for (const classroom of classes.docs) {
      const members = await getDocs(collection(db, "classrooms", classroom.id, "members"));
      $("school-classes").append(renderClassCard(classroom.id, classroom.data(), { memberCount: members.size }));
    }
  } catch {
    message("Your school details couldn't be loaded. Please check your school administrator access.");
  }
}

async function loadAllSchools() {
  try {
    const schools = await getDocs(query(collection(db, "schools"), orderBy("name")));
    if (schools.empty) $("all-schools").append(emptyCard("No schools have been added yet."));
    for (const school of schools.docs) {
      const card = element("article", "card class-card");
      card.append(element("h3", "", safeText(school.data().name, "School")));
      card.append(element("p", "", `School ID: ${school.id}`));
      $("all-schools").append(card);
    }
  } catch { message("The school list couldn't be loaded."); }
}

async function loadSupportQueue() {
  const queueElement = $("support-queue");
  queueElement.replaceChildren();
  try {
    const requests = await getDocs(query(collection(db, "supportRequests"), orderBy("createdAt", "desc"), limit(50)));
    if (requests.empty) { queueElement.append(emptyCard("The support inbox is clear.")); return; }
    for (const request of requests.docs) {
      const data = request.data();
      const item = element("article", "support-item card");
      item.append(element("h3", "", safeText(data.subject, "Support request")));
      item.append(element("p", "", `${safeText(data.category)} · ${data.createdAt?.toDate?.().toLocaleString?.() || "Date unavailable"}`));
      item.append(element("p", "", safeText(data.message)));
      const status = document.createElement("select");
      status.setAttribute("aria-label", "Request status");
      for (const value of ["new", "in-progress", "resolved"]) {
        const option = element("option", "", value === "in-progress" ? "In progress" : value[0].toUpperCase() + value.slice(1));
        option.value = value; status.append(option);
      }
      status.value = ["new", "in-progress", "resolved"].includes(data.status) ? data.status : "new";
      status.addEventListener("change", async () => {
        status.disabled = true;
        try { await updateDoc(doc(db, "supportRequests", request.id), { status: status.value }); }
        catch { status.value = data.status; message("Couldn't update that support request."); }
        finally { status.disabled = false; }
      });
      item.append(status);
      queueElement.append(item);
    }
  } catch { message("Support requests couldn't be loaded. Check that your moderator role is active."); }
}

$("join-class-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const classId = $("class-code").value.trim().toUpperCase();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const classroom = await getDoc(doc(db, "classrooms", classId));
    if (!classroom.exists()) { message("That class code wasn't found. Check the code and try again."); return; }
    await setDoc(doc(db, "classrooms", classId, "members", user.uid), {
      uid: user.uid, name: user.displayName || user.email || "Student", email: user.email || "", joinedAt: serverTimestamp()
    });
    message("You joined the classroom.", "success");
    event.currentTarget.reset();
    await loadStudentClasses();
  } catch { message("Couldn't join that classroom. Please try again."); }
  finally { button.disabled = false; }
});

$("create-class-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const id = await createClassroom($("class-name").value.trim());
    event.currentTarget.reset();
    message(`Classroom created. Share code ${id} with your students.`, "success");
    await loadTeacherClasses();
  } catch { message("Couldn't create the classroom. Please try again."); }
  finally { button.disabled = false; }
});

$("school-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    await updateDoc(doc(db, "schools", claims.schoolId), { name: $("school-name").value.trim(), updatedAt: serverTimestamp() });
    $("school-heading").textContent = $("school-name").value.trim();
    message("School name saved.", "success");
  } catch { message("Couldn't save the school name."); }
  finally { button.disabled = false; }
});

$("create-school-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const record = await addDoc(collection(db, "schools"), { name: $("new-school-name").value.trim(), createdAt: serverTimestamp() });
    event.currentTarget.reset();
    message(`School created. Assign school ID ${record.id} to its school administrator.`, "success");
    await loadAllSchools();
  } catch { message("Couldn't add the school. Please try again."); }
  finally { button.disabled = false; }
});

$("refresh-support").addEventListener("click", () => void loadSupportQueue());
$("logout-link").addEventListener("click", async (event) => {
  event.preventDefault();
  try { await signOut(auth); window.location.replace("/login"); }
  catch { message("Couldn't log out. Please try again."); }
});

onAuthStateChanged(auth, async (signedInUser) => {
  if (!signedInUser) { window.location.replace("/login"); return; }
  user = signedInUser;
  try {
    const token = await getIdTokenResult(user);
    claims = token.claims;
    const role = safeText(claims.role, "personal");
    $("welcome-title").textContent = `Hello${user.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}.`;
    $("role-badge").textContent = roleNames[role] || "Personal";
    if (role === "teacher") { show("teacher-panel"); await loadTeacherClasses(); }
    else if (role === "student") { show("student-panel"); await loadStudentClasses(); }
    else if (role === "school-administrator") { show("school-panel"); await loadSchoolDashboard(); }
    else if (role === "site-administrator") { show("site-panel"); await loadAllSchools(); }
    else if (["moderator", "support-team"].includes(role)) { show("moderator-panel"); await loadSupportQueue(); }
    else if (role === "personal") await loadPersonal();
    else { show("setup-panel"); }
  } catch {
    show("setup-panel");
    message("Your account access couldn't be checked. Refresh the page after signing in again.");
  }
  document.documentElement.dataset.authState = "ready";
});
