const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');
const header = document.querySelector('.site-header');
const heroScene = document.querySelector('.hero-scene');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const featureTabs = [...document.querySelectorAll('.feature-tab')];
const featurePanel = document.querySelector('#feature-panel');
const featureContent = {
  joystick: {
    index: '01 — DIRECTION CONTROL',
    heading: 'Haluskan setiap<br>perubahan arah.',
    description: 'Joystick analog 360° menerjemahkan arah dan intensitas gerak menjadi perintah yang responsif. Lepaskan kontrol untuk kembali ke posisi netral.',
    readout: '042°',
  },
  throttle: {
    index: '02 — ENGINE TELEGRAPH',
    heading: 'Atur tenaga<br>setahap demi setahap.',
    description: 'Tuas telegraf digital mengatur throttle motor dari 0 hingga 100%. Kontrol presisi membantu menyesuaikan laju untuk setiap kondisi.',
    readout: '064%',
  },
  accessory: {
    index: '03 — DECK ACCESSORIES',
    heading: 'Perangkat kapal,<br>dalam jangkauan.',
    description: 'Kendalikan kanal navigasi, lampu sorot, sirine, beacon, pompa bilga, dan jangkar lewat panel aksesori yang mudah dijangkau.',
    readout: '06 CH',
  },
};

if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });

  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navigation.querySelectorAll('a[aria-current="location"]').forEach((link) => link.removeAttribute('aria-current'));
      navigation.querySelector(`a[href="#${entry.target.id}"]`)?.setAttribute('aria-current', 'location');
    });
  }, { rootMargin: '-35% 0px -55% 0px' });

  document.querySelectorAll('main section[id]').forEach((section) => sectionObserver.observe(section));
} else {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
}

const updateScrollState = () => {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  document.documentElement.style.setProperty('--scroll-progress', String(height > 0 ? window.scrollY / height : 0));
  header.classList.toggle('is-scrolled', window.scrollY > 12);
};
window.addEventListener('scroll', updateScrollState, { passive: true });
window.addEventListener('resize', updateScrollState, { passive: true });
updateScrollState();

if (heroScene && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion.matches) {
  heroScene.addEventListener('pointermove', (event) => {
    const bounds = heroScene.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    heroScene.style.setProperty('--boat-x', `${x * -10}px`);
    heroScene.style.setProperty('--boat-y', `${y * -9}px`);
  });
  heroScene.addEventListener('pointerleave', () => {
    heroScene.style.removeProperty('--boat-x');
    heroScene.style.removeProperty('--boat-y');
  });
}

function selectFeature(tab, moveFocus = false) {
  const feature = featureContent[tab.dataset.feature];
  if (!feature) return;
  featureTabs.forEach((item) => {
    const selected = item === tab;
    item.classList.toggle('is-active', selected);
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  featurePanel.dataset.feature = tab.dataset.feature;
  featurePanel.setAttribute('aria-labelledby', tab.id);
  featurePanel.querySelector('.feature-index').textContent = feature.index;
  featurePanel.querySelector('.feature-copy h3').innerHTML = feature.heading;
  featurePanel.querySelector('.feature-description').textContent = feature.description;
  featurePanel.querySelector('.instrument-readout strong').textContent = feature.readout;
  featurePanel.querySelector('.feature-copy').animate?.(
    [{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 260, easing: 'ease-out' },
  );
  if (moveFocus) tab.focus();
}

featureTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectFeature(tab));
  tab.addEventListener('keydown', (event) => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % featureTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + featureTabs.length) % featureTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = featureTabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectFeature(featureTabs[nextIndex], true);
  });
});

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  menuButton.setAttribute('aria-label', open ? 'Buka menu' : 'Tutup menu');
  navigation.classList.toggle('is-open', !open);
});

navigation.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Buka menu');
  navigation.classList.remove('is-open');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || menuButton.getAttribute('aria-expanded') !== 'true') return;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Buka menu');
  navigation.classList.remove('is-open');
  menuButton.focus();
});
