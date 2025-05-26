const startBtn   = document.getElementById('start-btn');
const quizCont   = document.getElementById('quiz-container');
const tabs       = document.querySelectorAll('.tab');
const contents   = document.querySelectorAll('.tab-content');
const submitBtn  = document.getElementById('submit-btn');
const form       = document.getElementById('quiz-form');
const counts     = { dog: 0, cat: 0, rodent: 0 };

// Show quiz on button click
startBtn.addEventListener('click', () => {
  startBtn.style.display = 'none';
  quizCont.style.display = 'block';
});

// Activate a tab (by number 1–5)
function activateTab(n) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab == n));
  contents.forEach(c => c.classList.toggle('active', c.dataset.content == n));
}

// Clicking any tab always jumps there
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activateTab(tab.dataset.tab);
  });
});

// When an answer is chosen, tally and move to next (or show submit)
form.addEventListener('change', e => {
  const name = e.target.name;    // "q1"–"q5"
  const val  = e.target.value;   // "dog"/"cat"/"rodent"
  const num  = parseInt(name.slice(1));

  counts[val]++;

  if (num < 5) {
    activateTab(num + 1);
  } else {
    submitBtn.style.display = 'block';
  }
});

// Show result on submit
submitBtn.addEventListener('click', () => {
  let winner = 'rodent';
  if (counts.dog > counts.cat && counts.dog > counts.rodent) winner = 'dog';
  else if (counts.cat > counts.dog && counts.cat > counts.rodent) winner = 'cat';

  const messages = {
    dog: "You’re energetic and loving—<strong>a dog</strong> would be your perfect companion!",
    cat: "You value a mix of independence and affection—<strong>a cat</strong> suits you best!",
    rodent: "You prefer low-maintenance and cozy vibes—<strong>a rodent</strong> (hamster, guinea pig) is ideal!"
  };
  const rd = document.getElementById('result');
  rd.innerHTML = `<h2>Your Result:</h2><p>${messages[winner]}</p>`;
  rd.style.display = 'block';
});

// Initialize on tab 1
activateTab(1);