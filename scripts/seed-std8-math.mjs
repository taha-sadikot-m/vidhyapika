/**
 * Seed script: Standard 8 – Mathematics (complete course)
 * Run: node scripts/seed-std8-math.mjs
 * Requires the dev server to be running on localhost:3001 (or 3000)
 */

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'Admin@123';

let TOKEN = '';

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Login failed: ' + JSON.stringify(json));
  TOKEN = json.token;
  console.log('✅ Logged in');
}

// ── Course Data ──────────────────────────────────────────────────────────────

const TOPICS = [
  {
    name: 'Rational Numbers',
    description: 'Properties of rational numbers, representation on number line, and operations.',
    order: 1,
    subtopics: [
      { name: 'Introduction to Rational Numbers', order: 1, youtubeUrl: 'https://www.youtube.com/watch?v=9xoO6G8r3oI' },
      { name: 'Properties: Commutativity & Associativity', order: 2, youtubeUrl: 'https://www.youtube.com/watch?v=7Bd3xHNDUfE' },
      { name: 'Rational Numbers on Number Line', order: 3, youtubeUrl: 'https://www.youtube.com/watch?v=Pz3ew7WJ2SQ' },
      { name: 'Rational Numbers Between Two Rationals', order: 4, youtubeUrl: 'https://www.youtube.com/watch?v=INlFOMLJl0o' },
    ],
    prereq: { name: 'Fractions & Basic Number Systems', description: 'Check your knowledge of fractions and integers before starting.' },
    prereqQs: [
      { text: 'Is every integer a rational number?', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Which of the following is a rational number?', type: 'mcq', options: ['√2','π','3/4','√3'], correctAnswer: '3/4' },
      { text: 'The sum of two rational numbers is always rational.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Which property does a + b = b + a represent?', type: 'mcq', options: ['Associative','Commutative','Distributive','Closure'], correctAnswer: 'Commutative' },
      { text: '-7/5 is a rational number.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
    ],
    subtopicQs: [
      { text: 'The additive inverse of 3/7 is:', type: 'mcq', options: ['-3/7','7/3','-7/3','3/7'], correctAnswer: '-3/7' },
      { text: 'Rational numbers are closed under addition.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'The multiplicative inverse of -4/5 is:', type: 'mcq', options: ['5/4','-5/4','4/5','-4/5'], correctAnswer: '-5/4' },
      { text: '0 is a rational number.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Between any two rational numbers there are:', type: 'mcq', options: ['No rational numbers','Exactly one','Finite rational numbers','Infinitely many rational numbers'], correctAnswer: 'Infinitely many rational numbers' },
    ],
    finalQs: [
      { text: 'The product of a rational number and its reciprocal is:', type: 'mcq', options: ['0','1','-1','2'], correctAnswer: '1' },
      { text: '-5/0 is a rational number.', type: 'true_false', options: ['True','False'], correctAnswer: 'False' },
      { text: 'Which property is shown by a×(b+c) = a×b + a×c?', type: 'mcq', options: ['Closure','Commutative','Associative','Distributive'], correctAnswer: 'Distributive' },
      { text: 'The standard form of -12/18 is:', type: 'mcq', options: ['-12/18','-2/3','2/3','6/9'], correctAnswer: '-2/3' },
      { text: 'Rational numbers between 1/3 and 1/2 exist.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
    ],
  },
  {
    name: 'Linear Equations in One Variable',
    description: 'Solving linear equations and their applications in word problems.',
    order: 2,
    subtopics: [
      { name: 'Introduction & Simple Equations', order: 1, youtubeUrl: 'https://www.youtube.com/watch?v=l3XzepN03KQ' },
      { name: 'Equations with Variables on Both Sides', order: 2, youtubeUrl: 'https://www.youtube.com/watch?v=k5JFqasaCSU' },
      { name: 'Reducing Equations to Linear Form', order: 3, youtubeUrl: 'https://www.youtube.com/watch?v=rg3h-ZoEnXc' },
      { name: 'Word Problems', order: 4, youtubeUrl: 'https://www.youtube.com/watch?v=Ds8BtjlSKyc' },
    ],
    prereq: { name: 'Basic Algebra Readiness', description: 'Check basic algebra knowledge before this chapter.' },
    prereqQs: [
      { text: 'x + 5 = 12, what is x?', type: 'mcq', options: ['5','7','8','17'], correctAnswer: '7' },
      { text: 'A linear equation has degree 1.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'If 2x = 10, then x =', type: 'mcq', options: ['2','5','8','20'], correctAnswer: '5' },
      { text: 'An equation must have equal signs on both sides.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Solve: x - 3 = 7', type: 'mcq', options: ['4','10','7','3'], correctAnswer: '10' },
    ],
    subtopicQs: [
      { text: 'Solve: 3x + 4 = 19. What is x?', type: 'mcq', options: ['3','5','6','7'], correctAnswer: '5' },
      { text: 'A linear equation in one variable has exactly one solution.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'If 2x + 3 = x + 7, then x =', type: 'mcq', options: ['2','3','4','5'], correctAnswer: '4' },
      { text: 'Solve: 5(x - 2) = 3(x + 4)', type: 'mcq', options: ['11','10','9','8'], correctAnswer: '11' },
      { text: 'An equation 2x + 1 = 2x + 3 has no solution.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
    ],
    finalQs: [
      { text: 'Sum of three consecutive integers is 51. The largest is:', type: 'mcq', options: ['15','16','17','18'], correctAnswer: '18' },
      { text: 'If x/3 + 1 = 4, then x =', type: 'mcq', options: ['6','9','12','3'], correctAnswer: '9' },
      { text: 'Linear equations can have variables on both sides.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Solve: (2x-1)/3 = (x+2)/2', type: 'mcq', options: ['7','6','8','5'], correctAnswer: '7' },
      { text: 'A number added to its double gives 36. The number is:', type: 'mcq', options: ['10','12','14','18'], correctAnswer: '12' },
    ],
  },
  {
    name: 'Understanding Quadrilaterals',
    description: 'Properties of quadrilaterals, polygons, and their angle sum properties.',
    order: 3,
    subtopics: [
      { name: 'Polygons and Classification', order: 1, youtubeUrl: 'https://www.youtube.com/watch?v=4mT6FkZPMR4' },
      { name: 'Angle Sum Property of Quadrilaterals', order: 2, youtubeUrl: 'https://www.youtube.com/watch?v=9TtU2iF_Yxc' },
      { name: 'Parallelogram and Its Properties', order: 3, youtubeUrl: 'https://www.youtube.com/watch?v=LV_mIzUZCLQ' },
      { name: 'Special Quadrilaterals: Rhombus, Rectangle, Square', order: 4, youtubeUrl: 'https://www.youtube.com/watch?v=3TauBQJSHGQ' },
      { name: 'Kite and Trapezium', order: 5, youtubeUrl: 'https://www.youtube.com/watch?v=rfqCVUY82t8' },
    ],
    prereq: { name: 'Basic Geometry: Lines & Angles', description: 'Check your geometry basics.' },
    prereqQs: [
      { text: 'The sum of all angles in a triangle is:', type: 'mcq', options: ['90°','180°','270°','360°'], correctAnswer: '180°' },
      { text: 'A rectangle is a parallelogram.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'How many sides does a quadrilateral have?', type: 'mcq', options: ['3','4','5','6'], correctAnswer: '4' },
      { text: 'Opposite sides of a parallelogram are equal.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'A square has all sides equal.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
    ],
    subtopicQs: [
      { text: 'Sum of all interior angles of a quadrilateral is:', type: 'mcq', options: ['180°','270°','360°','540°'], correctAnswer: '360°' },
      { text: 'Diagonals of a rhombus bisect each other at right angles.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'A parallelogram with all sides equal is a:', type: 'mcq', options: ['Rectangle','Square','Rhombus','Trapezium'], correctAnswer: 'Rhombus' },
      { text: 'A trapezium has exactly one pair of parallel sides.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Diagonals of a rectangle are:', type: 'mcq', options: ['Unequal','Perpendicular','Equal','Parallel'], correctAnswer: 'Equal' },
    ],
    finalQs: [
      { text: 'Sum of interior angles of a hexagon is:', type: 'mcq', options: ['540°','720°','900°','360°'], correctAnswer: '720°' },
      { text: 'Every square is a rhombus.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'In a parallelogram, adjacent angles are:', type: 'mcq', options: ['Equal','Supplementary','Complementary','Reflex'], correctAnswer: 'Supplementary' },
      { text: 'A kite has two pairs of equal adjacent sides.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Number of diagonals in a pentagon:', type: 'mcq', options: ['3','4','5','6'], correctAnswer: '5' },
    ],
  },
  {
    name: 'Squares and Square Roots',
    description: 'Perfect squares, finding square roots by various methods.',
    order: 4,
    subtopics: [
      { name: 'Introduction to Perfect Squares', order: 1, youtubeUrl: 'https://www.youtube.com/watch?v=mbc3_e5lWw0' },
      { name: 'Properties of Square Numbers', order: 2, youtubeUrl: 'https://www.youtube.com/watch?v=K2lNijVEooc' },
      { name: 'Square Roots by Repeated Subtraction & Prime Factorisation', order: 3, youtubeUrl: 'https://www.youtube.com/watch?v=nAL3pBq2J_U' },
      { name: 'Square Root by Long Division Method', order: 4, youtubeUrl: 'https://www.youtube.com/watch?v=YsX3Hm7SMCE' },
    ],
    prereq: { name: 'Multiplication & Factors', description: 'Prerequisite check on multiplication and factors.' },
    prereqQs: [
      { text: '5² = ?', type: 'mcq', options: ['10','25','15','20'], correctAnswer: '25' },
      { text: 'The square of an odd number is always odd.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Which is a perfect square?', type: 'mcq', options: ['12','15','25','18'], correctAnswer: '25' },
      { text: '√64 = ?', type: 'mcq', options: ['6','7','8','9'], correctAnswer: '8' },
      { text: 'Square of an even number is always even.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
    ],
    subtopicQs: [
      { text: '√144 = ?', type: 'mcq', options: ['11','12','13','14'], correctAnswer: '12' },
      { text: 'Numbers ending in 2, 3, 7, 8 are never perfect squares.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Square root of 2.25 is:', type: 'mcq', options: ['1.5','1.25','0.5','2.5'], correctAnswer: '1.5' },
      { text: 'The square of 13 is 169.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Pythagorean triplet with 6 is:', type: 'mcq', options: ['(6,7,8)','(6,8,10)','(6,9,11)','(6,10,12)'], correctAnswer: '(6,8,10)' },
    ],
    finalQs: [
      { text: '√(1.96) = ?', type: 'mcq', options: ['1.2','1.3','1.4','1.6'], correctAnswer: '1.4' },
      { text: 'The smallest 4-digit perfect square is:', type: 'mcq', options: ['1000','1024','1089','1296'], correctAnswer: '1024' },
      { text: 'A perfect square cannot end with an odd number of zeros.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: '√(0.0001) = ?', type: 'mcq', options: ['0.01','0.001','0.1','0.0001'], correctAnswer: '0.01' },
      { text: '225 is a perfect square.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
    ],
  },
  {
    name: 'Comparing Quantities',
    description: 'Percentages, profit & loss, simple and compound interest.',
    order: 5,
    subtopics: [
      { name: 'Ratios and Percentages', order: 1, youtubeUrl: 'https://www.youtube.com/watch?v=X2jVap1YgwI' },
      { name: 'Profit and Loss', order: 2, youtubeUrl: 'https://www.youtube.com/watch?v=K3gJLTIVgNE' },
      { name: 'Simple Interest', order: 3, youtubeUrl: 'https://www.youtube.com/watch?v=XTa5ejOUBUQ' },
      { name: 'Compound Interest', order: 4, youtubeUrl: 'https://www.youtube.com/watch?v=P182Abv3fOk' },
    ],
    prereq: { name: 'Percentages & Ratios Basics', description: 'Basic percentage and ratio check.' },
    prereqQs: [
      { text: '25% of 200 is:', type: 'mcq', options: ['25','50','75','100'], correctAnswer: '50' },
      { text: 'Profit = SP - CP when SP > CP.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'If CP=100 and SP=120, profit% is:', type: 'mcq', options: ['10%','15%','20%','25%'], correctAnswer: '20%' },
      { text: 'Simple interest formula is P×R×T/100.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'Discount is always calculated on:', type: 'mcq', options: ['CP','SP','Marked Price','None'], correctAnswer: 'Marked Price' },
    ],
    subtopicQs: [
      { text: 'SI on ₹5000 at 4% for 2 years is:', type: 'mcq', options: ['₹200','₹300','₹400','₹500'], correctAnswer: '₹400' },
      { text: 'Compound interest is always greater than simple interest for same period > 1 year.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'A shopkeeper marks price 20% above CP and gives 10% discount. Profit% is:', type: 'mcq', options: ['8%','10%','12%','15%'], correctAnswer: '8%' },
      { text: 'CI = P(1 + R/100)ⁿ - P', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'GST stands for:', type: 'mcq', options: ['General Sales Tax','Goods & Services Tax','Government Service Tax','Gross Supply Tax'], correctAnswer: 'Goods & Services Tax' },
    ],
    finalQs: [
      { text: 'CI on ₹10000 at 10% for 2 years:', type: 'mcq', options: ['₹2000','₹2100','₹1900','₹2200'], correctAnswer: '₹2100' },
      { text: 'Loss occurs when SP < CP.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
      { text: 'If marked price=₹1500 and discount=20%, SP is:', type: 'mcq', options: ['₹1200','₹1250','₹1300','₹1100'], correctAnswer: '₹1200' },
      { text: 'Population of 50000 grows at 2% per year. After 1 year:', type: 'mcq', options: ['50500','51000','51500','52000'], correctAnswer: '51000' },
      { text: 'VAT is added on the selling price.', type: 'true_false', options: ['True','False'], correctAnswer: 'True' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createQuestions(contextType, contextId, questions) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await api('POST', '/api/admin/questions', {
      contextType, contextId,
      text: q.text, type: q.type,
      options: q.options ?? null,
      correctAnswer: q.correctAnswer ?? null,
      order: i,
    });
  }
  console.log(`   📝 ${questions.length} questions → ${contextType}/${contextId}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await login();

  // 1. Standard
  console.log('\n📚 Creating Standard 8...');
  const { id: standardId } = await api('POST', '/api/admin/standards', { name: 'Standard 8', description: 'Grade 8 curriculum', order: 8 });
  console.log('  Standard ID:', standardId);

  // 2. Class – Mathematics
  console.log('\n🏫 Creating Mathematics class...');
  const { id: classId } = await api('POST', `/api/admin/standards/${standardId}/classes`, { name: 'Mathematics', passingThreshold: 60 });
  console.log('  Class ID:', classId);

  // 3. Topics + Subtopics + Prerequisites + Questions
  for (const topic of TOPICS) {
    console.log(`\n📖 Topic: ${topic.name}`);
    const { id: topicId } = await api('POST', `/api/admin/classes/${classId}/topics`, {
      name: topic.name, description: topic.description,
      order: topic.order, finalTestThreshold: 60,
    });
    console.log('  Topic ID:', topicId);

    // Subtopics + subtopic questions (attached to first subtopic id)
    const subIds = [];
    for (let i = 0; i < topic.subtopics.length; i++) {
      const st = topic.subtopics[i];
      const { id: subId } = await api('POST', `/api/admin/topics/${topicId}/subtopics`, {
        name: st.name, order: st.order, youtubeUrl: st.youtubeUrl, passingThreshold: 60,
      });
      subIds.push(subId);
      console.log(`   Subtopic: ${st.name} (${subId})`);
    }
    // Attach subtopic questions to first subtopic
    await createQuestions('subtopic', subIds[0], topic.subtopicQs);

    // Prerequisite
    const { id: prereqId } = await api('POST', `/api/admin/topics/${topicId}/prerequisite`, {
      name: topic.prereq.name, description: topic.prereq.description, passingThreshold: 60, maxAIAttempts: 3,
    });
    console.log(`   Prereq: ${prereqId}`);
    await createQuestions('prereq', prereqId, topic.prereqQs);

    // Final test questions (contextId = topicId)
    await createQuestions('finaltest', topicId, topic.finalQs);
  }

  console.log('\n✅ SEED COMPLETE! Standard 8 Mathematics is ready.');
  console.log(`   Standard ID: ${standardId}`);
  console.log(`   Class ID: ${classId}`);
  console.log('\n👉 Next step: Enroll your student in this class from the Admin panel.');
}

main().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
