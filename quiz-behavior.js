(function () {
  let quizizz = { active: false, index: 0, timer: null };

  function addSharedStyles() {
    if (document.getElementById('quiz-behavior-styles')) return;

    const style = document.createElement('style');
    style.id = 'quiz-behavior-styles';
    style.textContent = `
      .options.answered li,
      .options-list.answered .option-label {
        cursor: default;
      }

      .options.answered li:not(.selected-option):not(.correct-answer),
      .options-list.answered .option-label:not(.selected-option):not(.correct-answer) {
        opacity: 0.72;
      }

      .selected-option {
        outline: 2px solid #c0392b;
      }

      .correct-answer {
        background-color: #d4efdf !important;
        border-color: #27ae60 !important;
        color: #145a32 !important;
        opacity: 1 !important;
      }

      .quiz-action-bar {
        position: fixed;
        left: 50%;
        bottom: 16px;
        z-index: 2000;
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 10px;
        width: min(920px, calc(100% - 24px));
        margin: 0;
        padding: 10px;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid rgba(226, 221, 247, 0.9);
        border-radius: 18px;
        box-shadow: 0 12px 30px rgba(74, 51, 160, 0.18);
        backdrop-filter: blur(8px);
        transform: translateX(-50%);
      }

      .quiz-action-bar .btn,
      .quiz-action-bar button {
        display: inline-block;
        background: linear-gradient(135deg, #6a4dbf 0%, #4a33a0 100%);
        color: #fff;
        border: none;
        padding: 10px 16px;
        border-radius: 999px;
        cursor: pointer;
        text-decoration: none;
        font: inherit;
        font-weight: 700;
        box-shadow: 0 8px 16px rgba(74, 51, 160, 0.2);
      }

      .quiz-action-bar .btn:hover,
      .quiz-action-bar button:hover {
        transform: translateY(-2px);
        text-decoration: none;
      }

      .quiz-final-summary {
        display: block !important;
        max-width: 900px;
        margin: 20px auto;
        padding: 16px;
        border-radius: 14px;
        background: #fff;
        border: 1px solid #d9dfe3;
        color: #2f2a3d;
        font-weight: 700;
      }

      body.quiz-controls-active {
        padding-bottom: 110px !important;
      }

      body.quiz-controls-active .bottom-nav {
        display: none !important;
      }

      @media (max-width: 520px) {
        .quiz-action-bar {
          align-items: stretch;
          bottom: 10px;
        }

        .quiz-action-bar .btn,
        .quiz-action-bar button {
          flex: 1 1 100%;
          text-align: center;
        }

        body.quiz-controls-active {
          padding-bottom: 160px !important;
        }
      }

      .question-card.quizizz-active {
        outline: 3px solid #6a4dbf;
        box-shadow: 0 0 0 5px rgba(106, 77, 191, 0.28);
        transition: outline 0.2s ease, box-shadow 0.2s ease;
      }

      #quizizzToggle {
        background: linear-gradient(135deg, #ff7a00 0%, #ff9500 100%);
      }

      body.quizizz-running .options-list .option-label {
        cursor: default;
      }
    `;
    document.head.appendChild(style);
  }

  function pickSpanishVoice() {
    try {
      const voices = window.speechSynthesis.getVoices();
      const esVoices = voices.filter(v => /^es/i.test(v.lang) || /^es/i.test(v.name));
      if (!esVoices.length) return null;
      // Preferir voces MASCULINAS, neuronales / en línea (más naturales).
      // Pistas de género en el nombre: masculino (diego, pablo, raul, jorge,
      // enrique, miguel, alvaro, Gonzalo, david, carlos) y femenino (sofia,
      // helena, valentina, paula, laura, maria, ana, rosa, esperanza).
      const maleHints = /(diego|pablo|raul|jorge|enrique|miguel|alvaro|gonzalo|david|carlos|tono|antonio|jose|pedro|\bmale\b|hombre|masculin)/i;
      const femaleHints = /(sofia|sofía|helena|valentina|paula|laura|maria|maría|ana|rosa|esperanza|\bfemale\b|mujer|femenin)/i;
      const ranked = esVoices.sort((a, b) => {
        const score = (v) => {
          const n = (v.name || '').toLowerCase();
          let s = 0;
          if (maleHints.test(n)) s += 200;
          if (femaleHints.test(n)) s -= 200;
          if (/neural/.test(n)) s += 100;
          if (/online|cloud/.test(n)) s += 60;
          if (/premium|natural|conversational/.test(n)) s += 40;
          if (/google|edge|azure/.test(n)) s += 30;
          if (/desktop|local/.test(n)) s -= 50;
          if (/es-(es|mx|ar|co|cl)/.test(v.lang || '')) s += 10;
          return s;
        };
        return score(b) - score(a);
      });
      return ranked[0];
    } catch (e) { return null; }
  }

  function speak(text, onEnd) {
    if (!('speechSynthesis' in window)) {
      if (onEnd) setTimeout(onEnd, 0);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text || '').replace(/^\s*\d+\.\s*/, ''));
      u.lang = 'es-ES';
      const voice = pickSpanishVoice();
      if (voice) u.voice = voice;
      // Parámetros más naturales: ritmo ligeramente pausado y tono neutro.
      u.rate = 0.92;
      u.pitch = 1.02;
      u.volume = 1;
      if (onEnd) u.onend = function () { onEnd(); };
      window.speechSynthesis.speak(u);
    } catch (e) {
      if (onEnd) onEnd();
    }
  }

  function revealAnswer(index) {
    const data = getQuizData();
    const card = document.querySelectorAll('.question-card')[index];
    if (!card) return;
    const item = data ? data[index] : null;
    const list = card.querySelector('.options-list');
    if (list) {
      list.classList.add('answered');
      const correctIndex = getCorrectIndex(item);
      const labels = Array.from(list.querySelectorAll('.option-label'));
      labels.forEach((label, i) => {
        if (quizizz.active) {
          if (i === correctIndex) label.classList.add('correct-answer');
        } else {
          label.classList.add('correct-answer');
        }
        const input = label.querySelector('input[type="radio"]');
        if (input) input.disabled = true;
      });
    }
    if (quizizz.active) return;
    const feedback = card.querySelector('.feedback');
    if (feedback) {
      feedback.style.display = 'block';
      feedback.className = 'feedback correct';
      if (item) feedback.innerHTML = buildFeedback(item, true);
    }
  }

  function quizizzStep() {
    if (!quizizz.active) return;
    const cards = Array.from(document.querySelectorAll('.question-card'));
    if (quizizz.index >= cards.length) {
      speak('Cuestionario completado. Modo Quizizz finalizado.');
      stopQuizizzMode();
      return;
    }
    cards.forEach(c => c.classList.remove('quizizz-active'));
    const card = cards[quizizz.index];
    card.classList.add('quizizz-active');
    try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    const title = card.querySelector('.question-title');
    const qText = title ? title.textContent : '';
    speak(qText, function () {
      quizizz.timer = setTimeout(function () {
        revealAnswer(quizizz.index);
        const data = getQuizData();
        const item = data ? data[quizizz.index] : null;
        let answerText = '';
        if (item) {
          const opts = getItemOptions(item);
          const ci = getCorrectIndex(item);
          answerText = (opts[ci] || '').replace(/^[a-d]\)\s*/i, '');
        }
        speak('Respuesta correcta: ' + answerText, function () {
          quizizz.timer = setTimeout(function () {
            quizizz.index++;
            quizizzStep();
          }, 2500);
        });
      }, 3000);
    });
  }

  function startQuizizzMode() {
    if (quizizz.active) return;
    if ('speechSynthesis' in window && window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = function () {};
    }
    quizizz.active = true;
    quizizz.index = 0;
    const btn = document.getElementById('quizizzToggle');
    if (btn) btn.textContent = '⏹ Detener Quizizz';
    quizizzStep();
  }

  function stopQuizizzMode() {
    quizizz.active = false;
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    clearTimeout(quizizz.timer);
    const btn = document.getElementById('quizizzToggle');
    if (btn) btn.textContent = '▶ Modo Quizizz (audio)';
    document.querySelectorAll('.question-card.quizizz-active').forEach(c => c.classList.remove('quizizz-active'));
  }

  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function getQuizData() {
    if (typeof questions !== 'undefined' && Array.isArray(questions)) return questions;
    if (typeof quizData !== 'undefined' && Array.isArray(quizData)) return quizData;
    if (typeof bancoPreguntas !== 'undefined' && Array.isArray(bancoPreguntas)) return bancoPreguntas;
    return null;
  }

  function getItemOptions(item) {
    return item.options || item.o || [];
  }

  function getCorrectIndex(item) {
    if (typeof item._shuffledCorrectIndex === 'number') return item._shuffledCorrectIndex;
    return typeof item.correct === 'number' ? item.correct : item.a;
  }

  function getFeedbackText(item) {
    return item.retro || item.f || '';
  }

  function shuffleOptionsWithAnswer(options, correctIndex) {
    const answers = options.map(opt => opt.replace(/^[a-d]\)\s*/i, ''));
    const correctAnswer = answers[correctIndex];
    const shuffledAnswers = shuffleArray(answers);
    const newCorrectIndex = shuffledAnswers.indexOf(correctAnswer);
    const labels = ['a', 'b', 'c', 'd'];
    const newOptions = shuffledAnswers.map((text, i) => `${labels[i]}) ${text}`);
    return { options: newOptions, correctIndex: newCorrectIndex };
  }

  function renderQuiz() {
    const data = getQuizData();
    const container = document.getElementById('quiz-container');
    if (!data || !container) return;

    container.innerHTML = '';

    const premiumOn = (typeof window.isPremiumActive === 'function')
      ? window.isPremiumActive()
      : (function () {
          try { return sessionStorage.getItem('premiumActive') === 'true'; } catch (e) { return false; }
        })();

    const preview = premiumOn ? data : data.slice(0, 5);

    preview.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'question-card';

      const questionTitle = document.createElement('h3');
      questionTitle.className = 'question-title';
      questionTitle.textContent = item.q;
      card.appendChild(questionTitle);

      const optionsList = document.createElement('ul');
      optionsList.className = 'options-list';
      optionsList.id = `options-${index}`;

      const originalOptions = getItemOptions(item);
      const originalCorrectIndex = getCorrectIndex(item);
      const { options, correctIndex } = shuffleOptionsWithAnswer(originalOptions, originalCorrectIndex);
      item._shuffledCorrectIndex = correctIndex;

      options.forEach((opt, optIndex) => {
        const listItem = document.createElement('li');
        listItem.className = 'option-item';

        const label = document.createElement('label');
        label.className = 'option-label';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `p${index}`;
        radio.value = optIndex;

        const span = document.createElement('span');
        span.textContent = opt;

        label.appendChild(radio);
        label.appendChild(span);
        listItem.appendChild(label);
        optionsList.appendChild(listItem);
      });

      card.appendChild(optionsList);

      const feedback = document.createElement('div');
      feedback.className = 'feedback';
      feedback.id = `feedback-${index}`;
      feedback.style.display = 'none';
      card.appendChild(feedback);

      container.appendChild(card);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function cleanRetro(text) {
    return String(text).replace(/^Retroalimentaci\S*n:\s*/i, '');
  }

  function cleanStaticRetro(text) {
    return cleanRetro(text)
      .replace(/^Incorrecto\.\s*/i, '')
      .replace(/^La opci\S*n correcta es [^:]+:\s*/i, '');
  }

  function buildFeedback(item, isCorrect) {
    const options = getItemOptions(item);
    const correctAnswer = options[getCorrectIndex(item)] || '';
    const retro = cleanRetro(getFeedbackText(item));
    const title = isCorrect ? '&iexcl;Correcto!' : '&iexcl;Incorrecto!';

    return `
      <strong>${title}</strong><br>
      <strong>Respuesta correcta:</strong> ${escapeHtml(correctAnswer)}<br>
      <strong>Retroalimentaci&oacute;n:</strong> ${escapeHtml(retro)}
    `;
  }

  function markListOptions(list, selectedIndex, correctIndex) {
    const options = Array.from(list.children);
    list.classList.add('answered');

    options.forEach((option, index) => {
      option.classList.toggle('selected-option', index === selectedIndex);
      option.classList.toggle('correct-answer', index === correctIndex);
      option.onclick = null;

      const input = option.querySelector('input[type="radio"]');
      if (input) input.disabled = true;
    });
  }

  function registerAnswer(index, isCorrect) {
    if (typeof registrarRespuesta === 'function') {
      registrarRespuesta(index, isCorrect);
      return;
    }

    if (typeof respondidas !== 'undefined' && respondidas[index] === undefined) {
      respondidas[index] = isCorrect;
      if (typeof actualizarPuntuacion === 'function') {
        actualizarPuntuacion();
      }
    }
  }

  function handleListOption(event) {
    if (quizizz.active) return;
    const li = event.target.closest('.options li');
    if (!li || li.querySelector('input[type="radio"]')) return;

    const list = li.closest('.options');
    const card = li.closest('.question-card');
    const data = getQuizData();
    if (!list || !card || !data) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (list.classList.contains('answered')) return;

    const feedback = card.querySelector('.feedback');
    const match = feedback && feedback.id ? feedback.id.match(/feedback-(\d+)/) : null;
    const questionIndex = match ? Number(match[1]) : Array.from(document.querySelectorAll('.question-card')).indexOf(card);
    const item = data[questionIndex];
    if (!item) return;

    const selectedIndex = Array.from(list.children).indexOf(li);
    const correctIndex = getCorrectIndex(item);
    const isCorrect = selectedIndex === correctIndex;

    markListOptions(list, selectedIndex, correctIndex);
    registerAnswer(questionIndex, isCorrect);

    if (feedback) {
      feedback.style.display = 'block';
      feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
      feedback.innerHTML = buildFeedback(item, isCorrect);
    }
  }

  function handleGeneratedRadio(event) {
    if (quizizz.active) return;
    const input = event.target.closest('input[type="radio"]');
    if (!input || !input.name.match(/^p\d+$/)) return;

    const data = getQuizData();
    const card = input.closest('.question-card');
    if (!data || !card) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (card.dataset.answered === 'true') return;
    card.dataset.answered = 'true';
    input.checked = true;

    const questionIndex = Number(input.name.replace('p', ''));
    const selectedIndex = Number(input.value);
    const item = data[questionIndex];
    if (!item) return;

    const correctIndex = getCorrectIndex(item);
    const isCorrect = selectedIndex === correctIndex;
    const list = input.closest('.options-list');
    const feedback = card.querySelector('.feedback');

    if (list) {
      const labels = Array.from(list.querySelectorAll('.option-label'));
      list.classList.add('answered');
      labels.forEach((label, index) => {
        label.classList.toggle('selected-option', index === selectedIndex);
        label.classList.toggle('correct-answer', index === correctIndex);
      });
    }

    card.querySelectorAll(`input[name="${input.name}"]`).forEach(radio => {
      radio.disabled = true;
    });

    registerAnswer(questionIndex, isCorrect);

    if (feedback) {
      feedback.style.display = 'block';
      feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
      feedback.innerHTML = buildFeedback(item, isCorrect);
    }
  }

  function handleStaticRadio(event) {
    if (quizizz.active) return;
    const input = event.target.closest('input[type="radio"][data-qid]');
    if (!input || typeof respuestasCorrectas === 'undefined') return;

    const block = input.closest('.question-block');
    if (!block) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (block.dataset.answered === 'true') return;
    block.dataset.answered = 'true';
    input.checked = true;

    const questionId = input.dataset.qid;
    const selectedValue = input.value;
    const correctValue = respuestasCorrectas[questionId];
    const isCorrect = selectedValue === correctValue;
    const feedback = document.getElementById(`fb-${questionId}`);
    const labels = Array.from(block.querySelectorAll('label'));
    const correctInput = block.querySelector(`input[value="${correctValue}"]`);
    const correctLabel = correctInput ? correctInput.closest('label') : null;

    labels.forEach(label => {
      const radio = label.querySelector('input[type="radio"]');
      if (radio) radio.disabled = true;
      label.classList.toggle('selected-option', radio === input);
      label.classList.toggle('correct-answer', label === correctLabel);
    });

    const correctText = correctLabel ? correctLabel.textContent.trim() : correctValue;
    const retro = retroalimentaciones && retroalimentaciones[questionId]
      ? cleanStaticRetro(retroalimentaciones[questionId])
      : 'La respuesta elegida es la adecuada.';

    if (feedback) {
      feedback.style.display = 'block';
      feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
      feedback.innerHTML = `
        <strong>${isCorrect ? '&iexcl;Correcto!' : '&iexcl;Incorrecto!'}</strong><br>
        <strong>Respuesta correcta:</strong> ${escapeHtml(correctText)}<br>
        <strong>Retroalimentaci&oacute;n:</strong> ${escapeHtml(retro)}
      `;
    }
  }

  function suppressAnsweredRadioChange(event) {
    const input = event.target.closest('input[type="radio"]');
    if (!input) return;

    const answeredContainer = input.closest('[data-answered="true"]');
    if (answeredContainer) {
      event.stopImmediatePropagation();
    }
  }

  function getTotalQuestions() {
    const data = getQuizData();
    if (data) return data.length;
    if (typeof respuestasCorrectas !== 'undefined') return Object.keys(respuestasCorrectas).length;

    const questionCards = document.querySelectorAll('.question-card').length;
    if (questionCards) return questionCards;
    return document.querySelectorAll('.question-block').length;
  }

  function getCorrectAnswersFromData(data) {
    let correctAnswers = 0;

    data.forEach((item, index) => {
      const correctIndex = getCorrectIndex(item);
      const checkedInput = document.querySelector(`input[name="p${index}"]:checked`);

      if (checkedInput) {
        if (Number(checkedInput.value) === correctIndex) {
          correctAnswers++;
        }
        return;
      }

      const feedback = document.getElementById(`feedback-${index}`);
      const card = feedback ? feedback.closest('.question-card') : document.querySelectorAll('.question-card')[index];
      if (!card) return;

      const selectedOption = card.querySelector('.selected-option');
      if (!selectedOption) return;

      const optionItems = Array.from(selectedOption.closest('ul').children);
      const selectedIndex = optionItems.indexOf(selectedOption);
      if (selectedIndex === correctIndex) {
        correctAnswers++;
      }
    });

    return correctAnswers;
  }

  function getCorrectAnswers() {
    const data = getQuizData();
    if (data) return getCorrectAnswersFromData(data);

    if (typeof respuestasCorrectas !== 'undefined') {
      return Object.keys(respuestasCorrectas).filter(questionId => {
        const checkedInput = document.querySelector(`input[name="${questionId}"]:checked`);
        return checkedInput && checkedInput.value === respuestasCorrectas[questionId];
      }).length;
    }

    if (typeof respondidas !== 'undefined') {
      return Object.values(respondidas).filter(Boolean).length;
    }

    return document.querySelectorAll('.selected-option.correct-answer').length;
  }

  function getAnsweredQuestions() {
    const data = getQuizData();
    if (data) {
      return data.filter((item, index) => {
        if (document.querySelector(`input[name="p${index}"]:checked`)) return true;
        const feedback = document.getElementById(`feedback-${index}`);
        const card = feedback ? feedback.closest('.question-card') : document.querySelectorAll('.question-card')[index];
        return Boolean(card && card.querySelector('.selected-option'));
      }).length;
    }

    if (typeof respuestasCorrectas !== 'undefined') {
      return Object.keys(respuestasCorrectas).filter(questionId => {
        return Boolean(document.querySelector(`input[name="${questionId}"]:checked`));
      }).length;
    }

    if (typeof respondidas !== 'undefined') return Object.keys(respondidas).length;
    return document.querySelectorAll('.selected-option').length;
  }

  function getSummaryElement() {
    let summary = document.getElementById('resultado-final') ||
      document.getElementById('score-container') ||
      document.getElementById('results');

    if (!summary) {
      summary = document.createElement('div');
      summary.id = 'resultado-final';
      const anchor = document.querySelector('.quiz-action-bar') || document.body;
      anchor.parentNode.insertBefore(summary, anchor);
    }

    summary.classList.add('quiz-final-summary');
    return summary;
  }

  function finishQuiz() {
    const total = getTotalQuestions();
    const correctAnswers = getCorrectAnswers();
    const answered = getAnsweredQuestions();
    const percentage = total ? (correctAnswers / total) * 100 : 0;
    const summary = getSummaryElement();

    summary.innerHTML = `
      Porcentaje de acertividad: ${percentage.toFixed(2)}%<br>
      Aciertos: ${correctAnswers} / ${total}<br>
      Preguntas respondidas: ${answered} / ${total}
    `;
    summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function ensurePremiumLock() {
    if (document.getElementById('premium-lock-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'premium-lock-banner';
    banner.className = 'premium-lock-banner';
    banner.innerHTML = `
      <span>Has completado 5 preguntas. Accede a pruebas premium de mayor complejidad.</span>
      <a class="btn" id="open-premium-lock">ACCEDE PRUEBAS PREMIUM</a>
      <a class="btn premium-menu-btn" id="open-premium-menu">IR AL MENÚ</a>
    `;
    document.body.appendChild(banner);

    document.getElementById('open-premium-lock').addEventListener('click', () => {
      window.location.href = 'index.html?premium=open';
    });

    document.getElementById('open-premium-menu').addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  function ensurePremiumQuizOverlay() {
    if (document.getElementById('premiumQuizOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'premiumQuizOverlay';
    overlay.className = 'premium-quiz-overlay';
      overlay.innerHTML = `
        <div class="premium-quiz-overlay-content">
          <h2 class="premium-modal-title">Límite alcanzado</h2>
          <p class="premium-modal-text">Has completado 5 preguntas. Accede a pruebas premium de mayor complejidad.</p>
          <a class="btn" id="overlay-go-index">ACCEDE PRUEBAS PREMIUM</a>
        </div>
      `;
    document.body.appendChild(overlay);

    document.getElementById('overlay-go-index').addEventListener('click', () => {
      window.location.href = 'index.html?premium=open';
    });
  }

  function hideQuizContent() {
    const quizContainer = document.getElementById('quiz-container');
    if (quizContainer) quizContainer.style.display = 'none';

    const actionBar = document.querySelector('.quiz-action-bar');
    if (actionBar) actionBar.style.display = 'none';
  }

  function enforcePremiumLimit() {
    const premiumOn = (typeof window.isPremiumActive === 'function')
      ? window.isPremiumActive()
      : (function () {
          try { return sessionStorage.getItem('premiumActive') === 'true'; } catch (e) { return false; }
        })();

    if (premiumOn) {
      const lock = document.getElementById('premium-lock-banner');
      if (lock) lock.classList.remove('show');
      const overlay = document.getElementById('premiumQuizOverlay');
      if (overlay) overlay.classList.remove('show');
      const quizContainer = document.getElementById('quiz-container');
      if (quizContainer) quizContainer.style.display = '';
      const actionBar = document.querySelector('.quiz-action-bar');
      if (actionBar) actionBar.style.display = '';
      return;
    }

    const answered = getAnsweredQuestions();
    if (answered >= 5) {
      const lock = document.getElementById('premium-lock-banner');
      if (lock) lock.classList.add('show');
      const overlay = document.getElementById('premiumQuizOverlay');
      if (overlay) overlay.classList.add('show');
      hideQuizContent();
    }
  }

  function ensureQuizControls() {
    if (document.querySelector('.quiz-action-bar')) return;

    document.body.classList.add('quiz-controls-active');

    const actionBar = document.createElement('div');
    actionBar.className = 'quiz-action-bar';

    const quizizzBtn = document.createElement('button');
    quizizzBtn.type = 'button';
    quizizzBtn.id = 'quizizzToggle';
    quizizzBtn.textContent = '▶ Modo Quizizz (audio)';
    quizizzBtn.addEventListener('click', function () {
      if (quizizz.active) stopQuizizzMode(); else startQuizizzMode();
    });

    const finishButton = document.createElement('button');
    finishButton.type = 'button';
    finishButton.textContent = 'Finalizar Cuestionario';
    finishButton.addEventListener('click', finishQuiz);

    const menuLink = document.createElement('a');
    menuLink.href = 'index.html';
    menuLink.className = 'btn';
    menuLink.textContent = 'Men\u00fa Principal';

    actionBar.appendChild(quizizzBtn);
    actionBar.appendChild(finishButton);
    actionBar.appendChild(menuLink);

    const existingNav = document.querySelector('.bottom-nav');
    if (existingNav) {
      existingNav.parentNode.insertBefore(actionBar, existingNav);
      return;
    }

    const script = document.currentScript;
    if (script && script.parentNode) {
      script.parentNode.insertBefore(actionBar, script);
      return;
    }

    document.body.appendChild(actionBar);
  }

  addSharedStyles();
  ensureQuizControls();
  ensurePremiumLock();
  renderQuiz();
  document.addEventListener('click', handleListOption, true);
  document.addEventListener('click', handleGeneratedRadio, true);
  document.addEventListener('click', handleStaticRadio, true);
  document.addEventListener('change', suppressAnsweredRadioChange, true);

  ['click', 'change'].forEach(evt => {
    document.addEventListener(evt, () => {
      enforcePremiumLimit();
    }, true);
  });
})();
