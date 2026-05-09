// src/ui.js
// All DOM rendering & event wiring. Reads ViewModels from Selectors,
// writes back through StateManager.

import {
  dashboardViewModel,
  holdingsViewModel,
  ledgerViewModel,
  tickersViewModel,
} from './view/Selectors.js';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const VIEWS = ['dashboard', 'holdings', 'ledger'];

export class UI {
  constructor(stateManager) {
    this.sm = stateManager;
    this.activeView = 'dashboard';
  }

  init() {
    this._bindNav();
    this._bindForm();
    this._bindSettings();
    this._bindIO();
    this.sm.on('state:changed', () => this.renderAll());
    this.renderAll();
    this._showView(this.activeView);
  }

  // ---- Navigation -----------------------------------------------------

  _bindNav() {
    $$('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this._showView(el.dataset.nav);
      });
    });
  }

  _showView(name) {
    if (!VIEWS.includes(name)) return;
    this.activeView = name;
    VIEWS.forEach((v) => {
      const panel = $(`#view-${v}`);
      if (panel) {
        panel.classList.toggle('hidden', v !== name);
        panel.classList.toggle('flex', v === name);
      }
    });
    $$('[data-nav]').forEach((el) => {
      const active = el.dataset.nav === name;
      el.classList.toggle('bg-white/5', active);
      el.classList.toggle('text-white', active);
      el.classList.toggle('text-on-surface-variant', !active);
      const icon = el.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.classList.toggle('fill', active);
        icon.classList.toggle('text-primary', active);
      }
    });
  }

  // ---- Render ---------------------------------------------------------

  renderAll() {
    const state = this.sm.getState();
    const derived = this.sm.getDerived();
    this._renderDashboard(state, derived);
    this._renderHoldings(state, derived);
    this._renderLedger(state);
    this._renderFormHelpers(state, derived);
    this._renderSettings(state);
  }

  _renderDashboard(state, derived) {
    const vm = dashboardViewModel(state, derived);
    $('#hero-total').textContent = vm.totalKidsValueFmt;
    $('#hero-fx').innerHTML =
      `<span class="material-symbols-outlined text-[16px]">currency_exchange</span> USD/ILS ${vm.fxRate} · ${vm.fxRateAsOf}`;
    $('#kids-grid').innerHTML = vm.kids.map(kidCardHtml).join('');
  }

  _renderHoldings(state, derived) {
    const vm = holdingsViewModel(state, derived);
    const tbody = $('#holdings-tbody');
    if (!vm.rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-on-surface-variant">אין אחזקות עדיין</td></tr>`;
      return;
    }
    tbody.innerHTML = vm.rows.map((r) => `
      <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
        <td class="py-5 pr-4">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
              <span class="material-symbols-outlined text-on-surface-variant text-base">show_chart</span>
            </div>
            <div>
              <div class="font-semibold text-white">${escapeHtml(r.ticker)}</div>
              <div class="text-xs text-on-surface-variant">${escapeHtml(r.company)}</div>
            </div>
          </div>
        </td>
        <td class="py-5 text-on-surface-variant">${r.totalSharesFmt}</td>
        <td class="py-5 text-on-surface-variant">
          ${r.priceFmt}
          <span class="text-[10px] uppercase tracking-widest opacity-70 mr-2">${escapeHtml(r.asOf)}</span>
        </td>
        <td class="py-5 text-white font-data-tabular">${r.valueFmt}</td>
        <td class="py-5">
          <div class="flex flex-col gap-1 text-xs">
            ${r.perKid.map((k) => `
              <div class="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-1.5">
                <span class="text-on-surface-variant">${escapeHtml(k.kidName)}</span>
                <span class="font-data-tabular text-white">${k.sharesFmt}</span>
              </div>`).join('')}
          </div>
        </td>
      </tr>
    `).join('');
  }

  _renderLedger(state) {
    const vm = ledgerViewModel(state);
    const tbody = $('#ledger-tbody');
    if (!vm.rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-on-surface-variant">היומן ריק</td></tr>`;
      return;
    }
    tbody.innerHTML = vm.rows.map((r) => `
      <tr class="border-b border-white/5 hover:bg-white/[0.02] group">
        <td class="py-4 pr-4 text-on-surface-variant text-xs">${escapeHtml(r.date)}</td>
        <td class="py-4">
          <span class="text-xs uppercase tracking-widest font-semibold ${r.sign === 'pos' ? 'text-secondary' : 'text-primary'}">
            ${escapeHtml(r.label)}
          </span>
        </td>
        <td class="py-4 text-white font-medium">${escapeHtml(r.who)}</td>
        <td class="py-4 text-on-surface-variant text-xs">${escapeHtml(r.details)}</td>
        <td class="py-4 text-left">
          <span class="font-data-tabular ${r.sign === 'pos' ? 'text-secondary' : 'text-white'}">${escapeHtml(r.amountFmt)}</span>
          <button data-del-tx="${r.id}" class="opacity-0 group-hover:opacity-100 transition-opacity mr-3 text-on-surface-variant hover:text-primary text-xs">מחק</button>
        </td>
      </tr>
    `).join('');

    $$('[data-del-tx]', tbody).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (confirm('למחוק את הפעולה?')) this.sm.removeTx(btn.dataset.delTx);
      });
    });
  }

  _renderFormHelpers(state, derived) {
    const kids = Object.values(state.kids);

    const depKid = $('#dep-kidId');
    if (depKid) {
      const cur = depKid.value;
      depKid.innerHTML = kids.map((k) => `<option value="${k.id}">${escapeHtml(k.name)}</option>`).join('');
      if (cur && state.kids[cur]) depKid.value = cur;
    }

    const allocBox = $('#buy-allocation');
    if (allocBox && allocBox.children.length === 0) {
      const split = Math.floor(100 / Math.max(kids.length, 1));
      const last = 100 - split * (kids.length - 1);
      allocBox.innerHTML = kids.map((k, i) => `
        <label class="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
          <span class="text-sm text-on-surface-variant">${escapeHtml(k.name)} %</span>
          <input type="number" min="0" max="100" step="0.01"
                 data-alloc-kid="${k.id}"
                 value="${i === kids.length - 1 ? last : split}"
                 class="bg-transparent text-white font-data-tabular text-left w-24 outline-none focus:text-primary" />
        </label>
      `).join('');

      // Auto-calculate the other kid's % when exactly 2 kids exist
      const allocInputs = $$('[data-alloc-kid]', allocBox);
      if (allocInputs.length === 2) {
        allocInputs.forEach((inp, i) => {
          inp.addEventListener('input', () => {
            allocInputs[1 - i].value = Math.max(0, 100 - parseFloat(inp.value || 0)).toFixed(2);
          });
        });
      }
    }

    const dl = $('#ticker-suggestions');
    if (dl) {
      const ts = tickersViewModel(state, derived);
      dl.innerHTML = ts.map((t) =>
        `<option value="${escapeHtml(t.ticker)}">${escapeHtml(t.company)}</option>`).join('');
    }
  }

  _renderSettings(state) {
    const fx = $('#settings-fx');
    if (fx && document.activeElement !== fx) fx.value = state.settings.lastFxRate;

    const list = $('#settings-kids');
    if (list) {
      list.innerHTML = Object.values(state.kids).map((k) => `
        <li class="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
          <input data-kid-name="${k.id}" value="${escapeHtml(k.name)}"
                 class="bg-transparent text-white outline-none flex-1 focus:text-primary" />
          <button data-rm-kid="${k.id}" class="text-on-surface-variant hover:text-primary text-xs">הסר</button>
        </li>
      `).join('');

      $$('[data-kid-name]', list).forEach((inp) =>
        inp.addEventListener('change', () =>
          this.sm.renameKid(inp.dataset.kidName, inp.value.trim() || 'ילד/ה')));
      $$('[data-rm-kid]', list).forEach((btn) =>
        btn.addEventListener('click', () => {
          try { this.sm.removeKid(btn.dataset.rmKid); }
          catch (e) { alert(e.message); }
        }));
    }

    const quoteBox = $('#settings-quotes');
    if (quoteBox) {
      const tickers = Object.values(state.quotes).sort((a, b) => a.ticker.localeCompare(b.ticker));
      quoteBox.innerHTML = tickers.length
        ? tickers.map((q) => `
          <div class="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
            <div class="flex-1">
              <div class="text-white font-semibold">${escapeHtml(q.ticker)}</div>
              <div class="text-xs text-on-surface-variant">${escapeHtml(q.company)} · ${escapeHtml(q.asOf)}</div>
            </div>
            <input type="number" step="0.01" min="0" value="${q.price ?? q.priceUsd}"
                   data-quote="${q.ticker}"
                   class="bg-transparent text-white font-data-tabular w-28 text-left outline-none focus:text-primary" />
            <span class="text-xs text-on-surface-variant">${escapeHtml(q.currency || 'USD')}</span>
          </div>`).join('')
        : '<p class="text-sm text-on-surface-variant">לא נשמרו ציטוטים. ייווצרו אוטומטית בעת קנייה ראשונה.</p>';

      $$('[data-quote]', quoteBox).forEach((inp) =>
        inp.addEventListener('change', () => {
          const ticker = inp.dataset.quote;
          const q = state.quotes[ticker];
          this.sm.upsertQuote({
            ticker,
            company: q?.company,
            price: parseFloat(inp.value),
            currency: q?.currency || 'USD',
            asOf: new Date().toISOString().slice(0, 10),
            source: 'manual',
          });
        }));
    }
  }

  // ---- Forms ----------------------------------------------------------

  _bindForm() {
    const typeSel = $('#tx-type');
    typeSel.addEventListener('change', () => this._showFormFor(typeSel.value));
    this._showFormFor(typeSel.value);

    $('#form-deposit').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        this.sm.recordDeposit({
          date: f.date.value,
          kidId: f.kidId.value,
          amountIls: parseFloat(f.amountIls.value),
          note: f.note.value || '',
        });
        f.reset();
        this._setDefaultDate(f.date);
        toast('ההפקדה נשמרה');
      } catch (err) { alert(err.message); }
    });

    const currencySel = $('[name="currency"]', $('#form-buy'));
    const fxRateWrapper = $('#fxRate-wrapper');
    const fxRateInp = $('[name="fxRate"]', $('#form-buy'));
    currencySel.addEventListener('change', () => {
      if (currencySel.value === 'ILS-Agorot') {
        fxRateWrapper.classList.add('hidden');
        fxRateInp.value = '0.01';
      } else {
        fxRateWrapper.classList.remove('hidden');
      }
    });

    $('#form-buy').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const allocation = {};
        $$('[data-alloc-kid]').forEach((inp) => {
          allocation[inp.dataset.allocKid] = parseFloat(inp.value);
        });
        this.sm.recordBuy({
          date: f.date.value,
          ticker: f.ticker.value.trim().toUpperCase(),
          company: f.company.value.trim(),
          totalShares: parseFloat(f.totalShares.value),
          kidsShares: parseFloat(f.kidsShares.value),
          allocation,
          price: parseFloat(f.price.value),
          currency: f.currency.value,
          fxRate: parseFloat(f.fxRate.value),
          feesIls: parseFloat(f.feesIls.value) || 0,
        });
        f.reset();
        this._setDefaultDate(f.date);
        toast('הקנייה נשמרה');
      } catch (err) { alert(err.message); }
    });

    $('#form-sell').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        this.sm.recordSell({
          date: f.date.value,
          ticker: f.ticker.value.trim().toUpperCase(),
          sharesSold: parseFloat(f.sharesSold.value),
          netIls: parseFloat(f.netIls.value),
        });
        f.reset();
        this._setDefaultDate(f.date);
        toast('המכירה נשמרה');
      } catch (err) { alert(err.message); }
    });

    $('#form-dividend').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        this.sm.recordDividend({
          date: f.date.value,
          ticker: f.ticker.value.trim().toUpperCase(),
          netIlsTotal: parseFloat(f.netIlsTotal.value),
        });
        f.reset();
        this._setDefaultDate(f.date);
        toast('הדיבידנד נשמר');
      } catch (err) { alert(err.message); }
    });

    $$('input[type="date"]').forEach((d) => this._setDefaultDate(d));
  }

  _setDefaultDate(input) {
    if (input && !input.value) input.value = new Date().toISOString().slice(0, 10);
  }

  _showFormFor(type) {
    ['DEPOSIT', 'BUY', 'SELL', 'DIVIDEND'].forEach((t) => {
      const f = $(`#form-${t.toLowerCase()}`);
      if (f) f.classList.toggle('hidden', t !== type);
    });
  }

  _bindSettings() {
    $('#btn-add-kid').addEventListener('click', () => {
      const name = prompt('שם הילד/ה החדש/ה');
      if (name && name.trim()) {
        this.sm.addKid(name.trim());
        const allocBox = $('#buy-allocation');
        if (allocBox) allocBox.innerHTML = '';
      }
    });

    $('#settings-fx').addEventListener('change', (e) => {
      this.sm.setFxRate(parseFloat(e.target.value));
    });
  }

  _bindIO() {
    $('#btn-export').addEventListener('click', () => {
      const blob = new Blob([this.sm.exportJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `juniorinvest-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    $('#btn-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        this.sm.importJson(await file.text());
        toast('הקובץ נטען');
      } catch (err) { alert('כשל בטעינה: ' + err.message); }
      e.target.value = '';
    });
  }
}

// ---- helpers ----

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 bg-background/90 border border-white/10 backdrop-blur-xl px-6 py-3 rounded-2xl text-white text-sm z-50 shadow-2xl';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

function kidCardHtml(kid) {
  const tone =
    kid.xirrSign === 'pos' ? 'text-secondary bg-secondary/10 border-secondary/20'
    : kid.xirrSign === 'neg' ? 'text-primary bg-primary/10 border-primary/20'
    : 'text-on-surface-variant bg-white/5 border-white/5';
  const arrow = kid.xirrSign === 'neg' ? 'trending_down' : 'trending_up';

  return `
    <div class="glass-panel rounded-3xl p-8 md:p-10 relative overflow-hidden flex flex-col h-full">
      <div class="flex justify-between items-start mb-8 relative z-10">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl font-bold text-white">
            ${escapeHtml(kid.name.slice(0, 1))}
          </div>
          <div>
            <h3 class="font-headline-md text-2xl font-bold text-white tracking-tight mb-1">${escapeHtml(kid.name)}</h3>
            <span class="text-on-surface-variant text-[10px] font-medium tracking-widest uppercase bg-white/5 px-3 py-1 rounded-lg border border-white/5">תיק ילד/ה</span>
          </div>
        </div>
        <div class="${tone} border px-3 py-1.5 rounded-xl text-xs font-data-tabular flex items-center gap-2">
          <span class="material-symbols-outlined text-[14px]">${arrow}</span>
          ${kid.xirrFmt}
        </div>
      </div>

      <div class="mb-6 relative z-10">
        <div class="font-display-lg text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">${kid.portfolioValueFmt}</div>
        <div class="flex items-center gap-3 text-sm text-on-surface-variant">
          <span>מזומן זמין:</span>
          <span class="font-data-tabular text-white font-semibold bg-white/5 px-3 py-1 rounded-lg border border-white/5">${kid.cashFmt}</span>
        </div>
      </div>

      <div class="mt-auto pt-6 border-t border-white/5 text-[10px] uppercase tracking-widest text-on-surface-variant">
        תשואה שנתית (XIRR)
      </div>
    </div>
  `;
}
