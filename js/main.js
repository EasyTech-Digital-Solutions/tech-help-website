const scrollNav = document.getElementById('scrollNav');
const heroNavTrigger = document.querySelector('.hero-nav-trigger');

if (scrollNav && heroNavTrigger && 'IntersectionObserver' in window) {
  const navObserver = new IntersectionObserver(([entry]) => {
    scrollNav.classList.toggle('visible', !entry.isIntersecting);
  });
  navObserver.observe(heroNavTrigger);
}

const navHamburger = document.querySelector('.nav-hamburger');
if (scrollNav && navHamburger) {
  const closeMobileNav = () => {
    scrollNav.classList.remove('nav-open');
    navHamburger.setAttribute('aria-expanded', 'false');
  };

  navHamburger.addEventListener('click', () => {
    const isOpen = scrollNav.classList.toggle('nav-open');
    navHamburger.setAttribute('aria-expanded', String(isOpen));
  });

  scrollNav.querySelectorAll('.scroll-nav-menu a').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMobileNav();
  });
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){entry.target.classList.add('visible');}
  });
},{threshold:0.08});
document.querySelectorAll('.service-row, .tip-card').forEach(el => observer.observe(el));

document.querySelectorAll('.tip-read-more').forEach(btn => {
  btn.addEventListener('click', function(){
    const card = this.closest('.tip-card');
    const expanded = card.classList.toggle('expanded');
    this.textContent = expanded ? 'Read less' : 'Read more';
    this.setAttribute('aria-expanded', expanded);
  });
});

window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

function loadAnalytics() {
  if (window.easyTechAnalyticsLoaded) return;
  window.easyTechAnalyticsLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-T2SYY041LV';
  document.head.appendChild(script);
  gtag('js', new Date());
  gtag('config', 'G-T2SYY041LV');
}

window.addEventListener('load', () => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadAnalytics, { timeout: 3000 });
  } else {
    setTimeout(loadAnalytics, 1500);
  }
});
