import { useState } from 'react';
import './App.css';

const APTITUDINI_STANDARD = [
  { id: 1, nume: 'HTML', curs: 'https://www.freecodecamp.org/learn' },
  { id: 2, nume: 'CSS', curs: 'https://web.dev/learn/css' },
  { id: 3, nume: 'JavaScript', curs: 'https://javascript.info' },
  { id: 4, nume: 'React', curs: 'https://react.dev/learn' },
  { id: 5, nume: 'Node.js', curs: 'https://nodejs.dev/en/learn' },
  { id: 6, nume: 'PostgreSQL', curs: 'https://www.postgresqltutorial.com' },
  { id: 7, nume: 'Python', curs: 'https://docs.python.org/3/tutorial' },
  { id: 8, nume: 'Git', curs: 'https://learngitbranching.js.org' },
];

const JOBURI_INITIALE = [
  {
    id: 1,
    titlu: 'Junior Front-End Developer',
    companie: 'TechCorp SRL',
    descriere: 'Căutăm un student pasionat de interfețe web moderne.',
    cerinte: ['HTML', 'CSS', 'JavaScript', 'React'],
  },
  {
    id: 2,
    titlu: 'Junior Full-Stack Developer',
    companie: 'WebSolutions',
    descriere: 'Dezvoltare aplicații web complete cu JavaScript și baze de date.',
    cerinte: ['React', 'Node.js', 'PostgreSQL', 'Git'],
  },
];

function App() {
  // Rolul activ: 'student' sau 'companie'
  const [rol, setRol] = useState('student');

  // Lista de joburi (acum poate crește când compania adaugă unul nou)
  const [joburi, setJoburi] = useState(JOBURI_INITIALE);

  // Stări pentru Student
  const [aptitudiniStudent, setAptitudiniStudent] = useState(['HTML', 'CSS', 'JavaScript']);
  const [rezultat, setRezultat] = useState(null);

  // Stări pentru formularul de Companie
  const [titluNou, setTitluNou] = useState('');
  const [companieNoua, setCompanieNoua] = useState('');
  const [descriereNoua, setDescriereNoua] = useState('');
  const [cerinteNoi, setCerinteNoi] = useState([]);
  const [mesajSucces, setMesajSucces] = useState('');

  // Bifare aptitudini pentru Student
  const schimbaAptitudineStudent = (numeTehnologie) => {
    if (aptitudiniStudent.includes(numeTehnologie)) {
      setAptitudiniStudent(aptitudiniStudent.filter((item) => item !== numeTehnologie));
    } else {
      setAptitudiniStudent([...aptitudiniStudent, numeTehnologie]);
    }
    setRezultat(null);
  };

  // Bifare cerințe pentru Job Nou (Companie)
  const schimbaCerintaJob = (numeTehnologie) => {
    if (cerinteNoi.includes(numeTehnologie)) {
      setCerinteNoi(cerinteNoi.filter((item) => item !== numeTehnologie));
    } else {
      setCerinteNoi([...cerinteNoi, numeTehnologie]);
    }
  };

  // Adăugare Job Nou
  const adaugaJob = (e) => {
    e.preventDefault();
    if (!titluNou || !companieNoua || cerinteNoi.length === 0) {
      alert('Te rog completează titlul, compania și alege cel puțin o cerință!');
      return;
    }

    const jobNou = {
      id: Date.now(),
      titlu: titluNou,
      companie: companieNoua,
      descriere: descriereNoua || 'Fără descriere adăugată.',
      cerinte: cerinteNoi,
    };

    setJoburi([jobNou, ...joburi]); // Îl punem primul în listă
    setTitluNou('');
    setCompanieNoua('');
    setDescriereNoua('');
    setCerinteNoi([]);
    setMesajSucces('Jobul a fost publicat! Treci pe modul "Sunt Student" ca să îl vezi.');
  };

  // Calcul scor potrivire
  const verificaPotrivirea = (job) => {
    const detinute = job.cerinte.filter((c) => aptitudiniStudent.includes(c));
    const lipsa = job.cerinte.filter((c) => !aptitudiniStudent.includes(c));
    const scor = Math.round((detinute.length / job.cerinte.length) * 100);

    setRezultat({ job, scor, detinute, lipsa });
  };

  return (
    <div className="container">
      <header className="header">
        <h1>JobFit</h1>
        <p>Descoperă ce șanse ai la jobul dorit și ce trebuie să înveți.</p>

        {/* Comutator de rol */}
        <div className="role-switcher">
          <button
            className={rol === 'student' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => {
              setRol('student');
              setMesajSucces('');
            }}
          >
            Sunt Student
          </button>
          <button
            className={rol === 'companie' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setRol('companie')}
          >
            Sunt Companie
          </button>
        </div>
      </header>

      {/* VEDEREA PENTRU STUDENT */}
      {rol === 'student' && (
        <>
          <section className="card">
            <h2>1. Profilul tău: Bifează ce tehnologii cunoști</h2>
            <div className="skills-grid">
              {APTITUDINI_STANDARD.map((skill) => (
                <label key={skill.id} className="skill-checkbox">
                  <input
                    type="checkbox"
                    checked={aptitudiniStudent.includes(skill.nume)}
                    onChange={() => schimbaAptitudineStudent(skill.nume)}
                  />
                  {skill.nume}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2>2. Joburi disponibile ({joburi.length})</h2>
            <div className="jobs-grid">
              {joburi.map((job) => (
                <div key={job.id} className="card job-card">
                  <h3>{job.titlu}</h3>
                  <p className="company">{job.companie}</p>
                  <p>{job.descriere}</p>
                  <p className="req-text">
                    <strong>Cerințe:</strong> {job.cerinte.join(', ')}
                  </p>
                  <button className="btn-primary" onClick={() => verificaPotrivirea(job)}>
                    Verifică Potrivirea
                  </button>
                </div>
              ))}
            </div>
          </section>

          {rezultat && (
            <section className="card result-card">
              <h2>Rezultat pentru: {rezultat.job.titlu}</h2>
              <div className="score-box">
                <span className="score-number">{rezultat.scor}%</span>
                <p>
                  Ai {rezultat.detinute.length} din cele {rezultat.job.cerinte.length} cerințe.
                </p>
              </div>

              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${rezultat.scor}%` }}></div>
              </div>

              {rezultat.lipsa.length === 0 ? (
                <p className="success-msg">Felicitări! Ești pregătită 100% pentru acest post!</p>
              ) : (
                <div className="recommendations">
                  <h3>Ce îți lipsește & Cursuri recomandate:</h3>
                  <ul>
                    {rezultat.lipsa.map((skillLipsa) => {
                      const infoSkill = APTITUDINI_STANDARD.find((s) => s.nume === skillLipsa);
                      return (
                        <li key={skillLipsa} className="rec-item">
                          <span>Îți lipsește: <strong>{skillLipsa}</strong></span>
                          <a
                            href={infoSkill?.curs}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-course"
                          >
                            Învață acum
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* VEDEREA PENTRU COMPANIE */}
      {rol === 'companie' && (
        <section className="card">
          <h2>Publică un Job Nou</h2>
          {mesajSucces && <p className="success-msg">{mesajSucces}</p>}

          <form onSubmit={adaugaJob} className="job-form">
            <div className="form-group">
              <label>Titlul postului:</label>
              <input
                type="text"
                placeholder="ex: Intern React Developer"
                value={titluNou}
                onChange={(e) => setTitluNou(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Numele companiei:</label>
              <input
                type="text"
                placeholder="ex: SoftTech Timișoara"
                value={companieNoua}
                onChange={(e) => setCompanieNoua(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Scurtă descriere:</label>
              <textarea
                rows="3"
                placeholder="Descrie pe scurt ce va face candidatul..."
                value={descriereNoua}
                onChange={(e) => setDescriereNoua(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Bifează tehnologiile cerute:</label>
              <div className="skills-grid">
                {APTITUDINI_STANDARD.map((skill) => (
                  <label key={skill.id} className="skill-checkbox">
                    <input
                      type="checkbox"
                      checked={cerinteNoi.includes(skill.nume)}
                      onChange={() => schimbaCerintaJob(skill.nume)}
                    />
                    {skill.nume}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary">
              Publică Jobul
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

export default App;