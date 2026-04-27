const admin = require('./backend/firebase/admin');
const db = admin.getDb();
async function run() {
  const snap = await db.collection('classEnrollments').get();
  console.log('Enrollments:', snap.docs.map(d => d.data()));
  
  const users = await db.collection('users').get();
  console.log('Users:', users.docs.map(d => ({id: d.id, name: d.data().name, classId: d.data().classId, role: d.data().role})));
}
run();
