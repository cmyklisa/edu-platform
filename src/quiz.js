// 測驗模式：點結構不直接顯示名稱，給 4 選 1 讓使用者猜。
// 用同一個 info-panel 容器渲染問題與回饋。

import { structureRegistry, SYSTEM_LABEL } from './structures.js';

const QUIZ_POOL_KINDS_EXCLUDED = new Set(['external', 'organ']);  // threat / heart 等不出題

export class QuizController {
  constructor(container) {
    this.container = container;
    this.enabled = false;
    this.score = { correct: 0, total: 0 };
    this.currentCorrectId = null;
    this.listeners = new Set();
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled) this._hide();
    this._notify();
  }

  startQuestion(structureId) {
    const correct = structureRegistry.get(structureId);
    if (!correct) return;
    if (QUIZ_POOL_KINDS_EXCLUDED.has(correct.kind)) return;  // 外部刺激不出題
    this.currentCorrectId = structureId;

    // 從同類型結構抽 3 個 distractors
    const pool = [...structureRegistry.values()].filter(s =>
      s.id !== structureId && !QUIZ_POOL_KINDS_EXCLUDED.has(s.kind)
    );
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const distractors = shuffled.slice(0, 3);
    const options = [...distractors, correct].sort(() => Math.random() - 0.5);
    this._renderQuestion(correct, options);
  }

  _renderQuestion(correct, options) {
    this.container.classList.add('visible');
    this.container.classList.add('quiz-mode');
    this.container.innerHTML = `
      <header class="info-panel-header">
        <div class="info-titles">
          <h2>🧠 測驗</h2>
          <p class="latin">點到的結構是？（4 選 1）</p>
        </div>
        <button class="info-close" aria-label="關閉" type="button">✕</button>
      </header>
      <ul class="quiz-options">
        ${options.map(o => `
          <li><button class="quiz-option" data-quiz-id="${o.id}" type="button">
            ${o.name_zh}
          </button></li>
        `).join('')}
      </ul>
      <p class="quiz-score">分數：${this.score.correct} / ${this.score.total}</p>
    `;
    this.container.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => this._showFeedback(btn.dataset.quizId, correct));
    });
    this.container.querySelector('.info-close')?.addEventListener('click', () => this._hide());
  }

  _showFeedback(guessedId, correct) {
    this.score.total += 1;
    const isCorrect = guessedId === correct.id;
    if (isCorrect) this.score.correct += 1;
    this._notify();

    const sysLabel = SYSTEM_LABEL[correct.system] ?? correct.system;
    this.container.innerHTML = `
      <header class="info-panel-header">
        <div class="info-titles">
          <h2 class="quiz-result ${isCorrect ? 'correct' : 'wrong'}">
            ${isCorrect ? '✓ 答對了' : '✗ 答錯了'}
          </h2>
          <p class="latin">${correct.name_la}</p>
        </div>
        <button class="info-close" aria-label="關閉" type="button">✕</button>
      </header>
      <div class="info-meta">
        <span class="system-tag system-${correct.system}">${sysLabel}</span>
      </div>
      <h3 class="quiz-correct-name">${correct.name_zh}</h3>
      <p class="info-function">${correct.function_zh}</p>
      ${Array.isArray(correct.diseases_zh) ? `
        <div class="info-diseases">
          <h3>相關疾病</h3>
          <ul>${correct.diseases_zh.map(d => `<li>${d}</li>`).join('')}</ul>
        </div>
      ` : ''}
      <p class="quiz-score">分數：${this.score.correct} / ${this.score.total}</p>
      <button class="quiz-continue" type="button">繼續挑戰 — 再點一個結構</button>
    `;
    this.container.querySelector('.quiz-continue')?.addEventListener('click', () => this._hide());
    this.container.querySelector('.info-close')?.addEventListener('click', () => this._hide());
  }

  _hide() {
    this.container.classList.remove('visible');
    this.container.classList.remove('quiz-mode');
    this.currentCorrectId = null;
  }

  reset() {
    this.score = { correct: 0, total: 0 };
    this._hide();
    this._notify();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _notify() { for (const fn of this.listeners) fn(this); }
}

// 在 topbar 內塞一顆切換按鈕
export function buildQuizToggle(container, quiz) {
  function render() {
    container.innerHTML = `
      <button class="quiz-toggle ${quiz.enabled ? 'active' : ''}" type="button"
              title="${quiz.enabled ? '退出測驗模式' : '進入測驗模式：點結構先猜再看答案'}">
        ${quiz.enabled
          ? `🧠 測驗中 ${quiz.score.correct}/${quiz.score.total} · 退出`
          : '🧠 測驗模式'}
      </button>
    `;
    container.querySelector('.quiz-toggle').addEventListener('click', () => {
      if (quiz.enabled) {
        quiz.reset();
        quiz.setEnabled(false);
      } else {
        quiz.setEnabled(true);
      }
    });
  }
  quiz.onChange(render);
  render();
}
