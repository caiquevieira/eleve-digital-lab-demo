/* Configuração do projeto: preencher a partir do briefing.md.
   IDs vazios = nenhum script de terceiros é carregado e o banner de cookies não aparece. */
const CONFIG = {
  ga4Id: '', // ex.: 'G-XXXXXXXXXX'
  metaPixelId: '', // ex.: '123456789012345'
};

const CHAVE_CONSENTIMENTO = 'ul-consentimento';

// data-track → eventos disparados (ver _docs/padrao-whatsapp.md)
const EVENTOS = {
  whatsapp: { ga: 'generate_lead', gaParams: { method: 'whatsapp' }, meta: 'Contact' },
  instagram: { ga: 'click_instagram' },
  'avaliar-google': { ga: 'click_avaliar_google' },
  'como-chegar': { ga: 'click_como_chegar', meta: 'FindLocation' },
};

let analyticsCarregado = false;

// Consent Mode v2: os 4 sinais seguem juntos a escolha do banner
function sinaisConsentimento(aceito) {
  const valor = aceito ? 'granted' : 'denied';
  return { analytics_storage: valor, ad_storage: valor, ad_user_data: valor, ad_personalization: valor };
}

function lerConsentimento() {
  try {
    return localStorage.getItem(CHAVE_CONSENTIMENTO);
  } catch {
    return null;
  }
}

function salvarConsentimento(valor) {
  try {
    localStorage.setItem(CHAVE_CONSENTIMENTO, valor);
  } catch {
    // Sem armazenamento (aba anônima restrita): vale só para esta visita.
  }
  if (window.gtag) window.gtag('consent', 'update', sinaisConsentimento(valor === 'aceito'));
}

function carregarAnalytics() {
  if (analyticsCarregado) return;
  analyticsCarregado = true;

  if (CONFIG.ga4Id) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${CONFIG.ga4Id}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    // Só chega aqui com a escolha "aceito" salva ou recém-feita
    window.gtag('consent', 'default', sinaisConsentimento(true));
    window.gtag('js', new Date());
    window.gtag('config', CONFIG.ga4Id);
  }

  if (CONFIG.metaPixelId) {
    /* Snippet oficial do Meta Pixel */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', CONFIG.metaPixelId);
    window.fbq('track', 'PageView');
  }
}

function iniciarConsentimento() {
  const usaAnalytics = Boolean(CONFIG.ga4Id || CONFIG.metaPixelId);
  const banner = document.getElementById('consentimento');
  const botoesAbrir = document.querySelectorAll('[data-abrir-consentimento]');

  if (!usaAnalytics) {
    botoesAbrir.forEach((b) => (b.hidden = true));
    return;
  }

  const abrir = () => {
    if (!banner) return;
    banner.hidden = false;
    document.body.classList.add('consentimento-aberto');
  };
  const fechar = () => {
    if (!banner) return;
    banner.hidden = true;
    document.body.classList.remove('consentimento-aberto');
  };

  const escolha = lerConsentimento();
  if (escolha === 'aceito') carregarAnalytics();
  else if (!escolha) abrir();

  banner?.querySelector('[data-consentimento="aceitar"]')?.addEventListener('click', () => {
    salvarConsentimento('aceito');
    fechar();
    carregarAnalytics();
  });

  banner?.querySelector('[data-consentimento="recusar"]')?.addEventListener('click', () => {
    salvarConsentimento('recusado');
    fechar();
    // Scripts já carregados só saem da página com um recarregamento.
    if (analyticsCarregado) location.reload();
  });

  botoesAbrir.forEach((b) => b.addEventListener('click', abrir));
}

function iniciarTracking() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-track]');
    if (!link || !analyticsCarregado) return;
    const evento = EVENTOS[link.dataset.track];
    if (!evento) return;
    const origem = link.dataset.origem || '';
    if (window.gtag && evento.ga) window.gtag('event', evento.ga, { ...evento.gaParams, origem });
    if (window.fbq && evento.meta) window.fbq('track', evento.meta, { origem });
  });
}

/* Galeria com "Ver mais": sem JS a grade aparece completa; com JS mostra as 6 primeiras. */
function iniciarGaleria() {
  document.querySelectorAll('[data-galeria-grade]').forEach((grade) => {
    const botao = document.querySelector(`[data-galeria-mais="${grade.id}"]`);
    if (!botao) return;
    grade.classList.add('galeria-recolhida');
    botao.hidden = false;
    botao.addEventListener('click', () => {
      grade.classList.remove('galeria-recolhida');
      botao.hidden = true;
    });
  });
}

/* Banners do hero: abas (padrão WAI-ARIA, setas do teclado) com troca automática.
   Sem JS fica o primeiro banner. Com movimento reduzido, não troca sozinho. */
function iniciarBanners() {
  const raiz = document.querySelector('[data-banners]');
  if (!raiz) return;
  const abas = [...raiz.querySelectorAll('[data-aba]')];
  const banners = [...raiz.querySelectorAll('[data-banner]')];
  const botaoPausa = raiz.querySelector('[data-banners-pausa]');
  const TEMPO = 7000;
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let atual = 0;
  let timer = null;
  let pausadoPeloUsuario = movimentoReduzido;
  let emEspera = false;

  raiz.style.setProperty('--banner-tempo', `${TEMPO}ms`);

  const mostrar = (indice, focar = false) => {
    atual = (indice + abas.length) % abas.length;
    abas.forEach((aba, i) => {
      const ativa = i === atual;
      aba.setAttribute('aria-selected', String(ativa));
      aba.tabIndex = ativa ? 0 : -1;
      banners[i].classList.toggle('banner-ativo', ativa);
    });
    if (focar) abas[atual].focus();
    reiniciar();
  };

  const rodando = () => !pausadoPeloUsuario && !emEspera && !document.hidden;

  // Reinicia o relógio e a linha de progresso da aba ativa
  const reiniciar = () => {
    clearTimeout(timer);
    raiz.classList.remove('banners-rodando');
    raiz.classList.toggle('banners-parado', pausadoPeloUsuario);
    raiz.classList.toggle('banners-espera', emEspera);
    if (!rodando()) return;
    void raiz.offsetWidth;
    raiz.classList.add('banners-rodando');
    timer = setTimeout(() => mostrar(atual + 1), TEMPO);
  };

  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => mostrar(i));
    aba.addEventListener('keydown', (e) => {
      const passo = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (passo) mostrar(atual + passo, true);
      else if (e.key === 'Home') mostrar(0, true);
      else if (e.key === 'End') mostrar(abas.length - 1, true);
      else return;
      e.preventDefault();
    });
  });

  // Mouse em cima ou foco dentro: espera; ao sair, recomeça a contagem
  const esperar = (valor) => {
    if (emEspera === valor) return;
    emEspera = valor;
    reiniciar();
  };
  raiz.addEventListener('mouseenter', () => esperar(true));
  raiz.addEventListener('mouseleave', () => esperar(raiz.contains(document.activeElement)));
  raiz.addEventListener('focusin', () => esperar(true));
  raiz.addEventListener('focusout', (e) => {
    if (!raiz.contains(e.relatedTarget)) esperar(raiz.matches(':hover'));
  });
  document.addEventListener('visibilitychange', reiniciar);

  // Arrastar para o lado no celular troca o banner
  let toqueX = null;
  const palco = raiz.querySelector('.banners-palco');
  palco?.addEventListener('touchstart', (e) => (toqueX = e.touches[0].clientX), { passive: true });
  palco?.addEventListener('touchend', (e) => {
    if (toqueX === null) return;
    const dx = e.changedTouches[0].clientX - toqueX;
    toqueX = null;
    if (Math.abs(dx) > 50) mostrar(atual + (dx < 0 ? 1 : -1));
  });

  if (botaoPausa && !movimentoReduzido) {
    botaoPausa.hidden = false;
    botaoPausa.addEventListener('click', () => {
      pausadoPeloUsuario = !pausadoPeloUsuario;
      botaoPausa.setAttribute(
        'aria-label',
        pausadoPeloUsuario ? 'Retomar a troca automática dos banners' : 'Pausar a troca automática dos banners'
      );
      reiniciar();
    });
  }

  mostrar(0);
}

iniciarConsentimento();
iniciarTracking();
iniciarGaleria();
iniciarBanners();
