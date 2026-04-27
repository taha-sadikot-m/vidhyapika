import * as fs from 'fs';
import * as path from 'path';
import { parseCSV } from '../src/utils/csvImport';
import {
  listStandards, createStandard,
  listClasses, createClass,
  listTopics, createTopic,
  listSubTopics, createSubTopic,
  listPrerequisites, createPrerequisite,
  listQuestions, createQuestion
} from '../backend/repositories/curriculumRepo';

async function run() {
  console.log('Reading CSV...');
  const csvPath = process.argv[2];
  if (!csvPath) throw new Error('Please provide a path to the CSV file.');
  
  let csvText = fs.readFileSync(csvPath, 'utf8');
  
  // Replace headers to match what parseCSV expects
  const lines = csvText.replace(/\r\n/g, '\n').split('\n');
  lines[0] = lines[0].replace(/Standard/i, 'standard_name').replace(/Section/i, 'section_name') + ',question_type';
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      lines[i] = lines[i] + ',text';
    }
  }
  csvText = lines.join('\n');
  
  console.log('Fetching existing standards to merge against...');
  const existingStandards = await listStandards();
  
  // Note: parseCSV expects the mock data format to merge. We don't have the full tree in memory.
  // Actually, we can just pass [] because we'll handle the merging manually by checking the DB.
  console.log('Parsing CSV...');
  const { standards, errors } = parseCSV(csvText, []);
  
  if (errors.length > 0) {
    console.error('Errors found in CSV:', errors);
    process.exit(1);
  }

  console.log(`Found ${standards.length} standards to process.`);

  for (const std of standards) {
    console.log(`Processing Standard: ${std.name}`);
    let dbStd = existingStandards.find(s => s.name.toLowerCase() === std.name.toLowerCase());
    let stdId = dbStd?.id;
    if (!stdId) {
      stdId = await createStandard({ name: std.name, order: existingStandards.length + 1 });
      console.log(`  -> Created Standard ID: ${stdId}`);
    }

    const existingClasses = await listClasses(stdId);
    for (const cls of std.classes) {
      console.log(`  Processing Class: ${cls.name}`);
      let dbCls = existingClasses.find(c => c.name.toLowerCase() === cls.name.toLowerCase());
      let clsId = dbCls?.id;
      if (!clsId) {
        clsId = await createClass({ name: cls.name, standardId: stdId, passingThreshold: 60 });
        console.log(`    -> Created Class ID: ${clsId}`);
      }

      const existingTopics = await listTopics(clsId);
      for (const topic of cls.curriculum) {
        console.log(`    Processing Topic: ${topic.title}`);
        let dbTopic = existingTopics.find(t => t.name.toLowerCase() === topic.title.toLowerCase());
        let topicId = dbTopic?.id;
        if (!topicId) {
          topicId = await createTopic({
            name: topic.title,
            classId: clsId,
            order: topic.sequence || existingTopics.length + 1,
            finalTestThreshold: 60
          });
          console.log(`      -> Created Topic ID: ${topicId}`);
        }

        // Prerequisites
        if (topic.prerequisites && topic.prerequisites.length > 0) {
          const existingPrereqs = await listPrerequisites(topicId);
          for (const prereq of topic.prerequisites) {
            if (!existingPrereqs.some(p => p.name.toLowerCase() === prereq.title.toLowerCase())) {
              await createPrerequisite(topicId, {
                name: prereq.title,
                passingThreshold: prereq.passingThreshold || 60,
                maxAIAttempts: 3
              });
              console.log(`        -> Created Prereq: ${prereq.title}`);
            }
          }
        }

        // Subtopics
        const existingSubTopics = await listSubTopics(topicId);
        for (const sub of topic.subTopics) {
          let dbSub = existingSubTopics.find(s => s.name.toLowerCase() === sub.title.toLowerCase());
          let subId = dbSub?.id;
          if (!subId) {
            subId = await createSubTopic({
              name: sub.title,
              topicId: topicId,
              order: sub.sequenceOrder || existingSubTopics.length + 1,
              youtubeUrl: sub.videoUrl,
              passingThreshold: 60
            });
            console.log(`        -> Created SubTopic: ${sub.title}`);
          }

          // Subtopic Quizzes
          if (sub.quizzes && sub.quizzes.length > 0) {
            const existingQs = await listQuestions('subtopic', subId);
            for (const q of sub.quizzes) {
              if (!existingQs.some(eq => eq.text.toLowerCase() === q.text.toLowerCase())) {
                await createQuestion({
                  contextType: 'subtopic',
                  contextId: subId,
                  text: q.text,
                  type: q.type as any,
                  options: q.options || [],
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation,
                  order: existingQs.length + 1
                } as any);
                console.log(`          -> Created Question for ${sub.title}`);
              }
            }
          }
        }

        // Topic pre-eval quizzes
        if (topic.preEvaluationQuiz && topic.preEvaluationQuiz.length > 0) {
          const existingQs = await listQuestions('prereq', topicId); // wait, pre-eval is stored under 'prereq' context type or 'finaltest'?
          // Wait, 'preEvaluationQuiz' is usually topic-level. Let's assume it maps to 'prereq' contextType for the topic.
          // Wait, the API schema only allows: "prereq", "subtopic", "finaltest".
          // "prereq" is actually for Prerequisite context. Wait, where do we store pre-eval?
          // I will store preEvaluationQuiz as 'prereq' contextType but contextId = topicId. This is what the UI does in listQuestions.
          for (const q of topic.preEvaluationQuiz) {
             if (!existingQs.some(eq => eq.text.toLowerCase() === q.text.toLowerCase())) {
                await createQuestion({
                  contextType: 'prereq', // wait, pre-eval
                  contextId: topicId,
                  text: q.text,
                  type: q.type as any,
                  options: q.options || [],
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation,
                  order: existingQs.length + 1
                } as any);
                console.log(`          -> Created Pre-Eval Question for ${topic.title}`);
             }
          }
        }

        // Topic post-eval quizzes -> finaltest
        if (topic.postEvaluationQuiz && topic.postEvaluationQuiz.length > 0) {
          const existingQs = await listQuestions('finaltest', topicId);
          for (const q of topic.postEvaluationQuiz) {
             if (!existingQs.some(eq => eq.text.toLowerCase() === q.text.toLowerCase())) {
                await createQuestion({
                  contextType: 'finaltest',
                  contextId: topicId,
                  text: q.text,
                  type: q.type as any,
                  options: q.options || [],
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation,
                  order: existingQs.length + 1
                } as any);
                console.log(`          -> Created FinalTest Question for ${topic.title}`);
             }
          }
        }

      }
    }
  }

  console.log('Import complete.');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
