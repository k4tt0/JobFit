-- =====================================================
-- JobFit database (PostgreSQL) - English version
-- Run with:  psql -U postgres -d jobfit -f jobfit_en.sql
-- =====================================================

-- Read this file as UTF-8 regardless of the console
SET client_encoding TO 'UTF8';

-- Needed for hashing the seed passwords (bcrypt) inside Postgres
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Clean re-run: drop the new tables (reverse dependency order)...
DROP TABLE IF EXISTS job_skills;
DROP TABLE IF EXISTS student_skills;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS users;

-- ...and the old Romanian-named tables from the first version
DROP TABLE IF EXISTS aptitudini_job;
DROP TABLE IF EXISTS aptitudini_student;
DROP TABLE IF EXISTS joburi;
DROP TABLE IF EXISTS aptitudini_standard;
DROP TABLE IF EXISTS utilizatori;

-- -----------------------------------------------------
-- 1. users
-- -----------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,          -- stores the HASH, never plain text
    role          VARCHAR(10)  NOT NULL
                  CHECK (role IN ('student', 'company'))
);

-- -----------------------------------------------------
-- 2. jobs
-- -----------------------------------------------------
CREATE TABLE jobs (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER      NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,
    job_title   VARCHAR(150) NOT NULL,
    description TEXT
);

-- -----------------------------------------------------
-- 3. skills (fixed standard list)
-- -----------------------------------------------------
CREATE TABLE skills (
    id                    SERIAL PRIMARY KEY,
    technology_name       VARCHAR(100) NOT NULL UNIQUE,
    affiliate_course_link TEXT
);

-- -----------------------------------------------------
-- 4. student_skills (junction: which skills a student has)
-- -----------------------------------------------------
CREATE TABLE student_skills (
    student_id INTEGER NOT NULL
               REFERENCES users(id) ON DELETE CASCADE,
    skill_id   INTEGER NOT NULL
               REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, skill_id)
);

-- -----------------------------------------------------
-- 5. job_skills (junction: which skills a job requires)
-- -----------------------------------------------------
CREATE TABLE job_skills (
    job_id   INTEGER NOT NULL
             REFERENCES jobs(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL
             REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (job_id, skill_id)
);

-- Indexes for the lookups the API will do most often
CREATE INDEX idx_jobs_company    ON jobs(company_id);
CREATE INDEX idx_student_skills  ON student_skills(student_id);
CREATE INDEX idx_job_skills      ON job_skills(job_id);

-- =====================================================
-- SEED DATA (test data)
-- =====================================================

INSERT INTO skills (id, technology_name, affiliate_course_link) VALUES
 (1, 'HTML',       'https://www.freecodecamp.org/learn'),
 (2, 'CSS',        'https://web.dev/learn/css'),
 (3, 'JavaScript', 'https://javascript.info'),
 (4, 'React',      'https://react.dev/learn'),
 (5, 'Node.js',    'https://nodejs.dev/en/learn'),
 (6, 'PostgreSQL', 'https://www.postgresqltutorial.com'),
 (7, 'Python',     'https://docs.python.org/3/tutorial'),
 (8, 'Git',        'https://learngitbranching.js.org');

-- Passwords are hashed with bcrypt via pgcrypto. All test accounts use: password123
-- (compatible with the bcrypt / bcryptjs packages in Node)
INSERT INTO users (id, full_name, email, password_hash, role) VALUES
 (1, 'Ana Popescu',   'ana@student.ro',       crypt('password123', gen_salt('bf')), 'student'),
 (2, 'Mihai Ionescu', 'mihai@student.ro',     crypt('password123', gen_salt('bf')), 'student'),
 (3, 'TechCorp SRL',  'hr@techcorp.ro',       crypt('password123', gen_salt('bf')), 'company'),
 (4, 'WebSolutions',  'jobs@websolutions.ro', crypt('password123', gen_salt('bf')), 'company');

INSERT INTO jobs (id, company_id, job_title, description) VALUES
 (1, 3, 'Junior Front-End Developer',  'We are looking for a student passionate about web interfaces.'),
 (2, 4, 'Junior Full-Stack Developer', 'Development of modern web applications with JavaScript.');

INSERT INTO job_skills (job_id, skill_id) VALUES
 (1, 1), (1, 2), (1, 3), (1, 4),     -- Front-End: HTML, CSS, JS, React
 (2, 4), (2, 5), (2, 6), (2, 8);     -- Full-Stack: React, Node, PostgreSQL, Git

INSERT INTO student_skills (student_id, skill_id) VALUES
 (1, 1), (1, 2), (1, 3),             -- Ana: HTML, CSS, JS
 (2, 4), (2, 5);                     -- Mihai: React, Node.js

-- Since we inserted explicit ids, move the sequences forward so
-- future INSERTs (from the API) don't collide with the seed rows
SELECT setval('users_id_seq',  (SELECT MAX(id) FROM users));
SELECT setval('jobs_id_seq',   (SELECT MAX(id) FROM jobs));
SELECT setval('skills_id_seq', (SELECT MAX(id) FROM skills));

-- =====================================================
-- USEFUL QUERIES (for the matching part / your teammates)
-- =====================================================

-- A) Match score of every student against one job (here job id = 1)
--    score = skills the student has / skills the job requires * 100
/*
SELECT u.id,
       u.full_name,
       ROUND(100.0 * COUNT(ss.skill_id) / total.cnt, 0) AS match_score
FROM users u
CROSS JOIN (SELECT COUNT(*) AS cnt FROM job_skills WHERE job_id = 1) total
LEFT JOIN job_skills js
       ON js.job_id = 1
LEFT JOIN student_skills ss
       ON ss.student_id = u.id AND ss.skill_id = js.skill_id
WHERE u.role = 'student'
GROUP BY u.id, u.full_name, total.cnt;
*/

-- B) Missing skills + recommended course for ONE student on ONE job
--    (student 1 = Ana, job 1 = Front-End  ->  React)
/*
SELECT s.technology_name, s.affiliate_course_link
FROM job_skills js
JOIN skills s ON s.id = js.skill_id
WHERE js.job_id = 1
  AND js.skill_id NOT IN (
        SELECT skill_id FROM student_skills WHERE student_id = 1
  );
*/

-- C) Login check example (what the API does):
--    returns a row only if the password matches the stored hash
/*
SELECT id, full_name, role
FROM users
WHERE email = 'ana@student.ro'
  AND password_hash = crypt('password123', password_hash);
*/
