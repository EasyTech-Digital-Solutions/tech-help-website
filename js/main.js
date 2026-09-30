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
    const card = this.closest('.tip-card') || this.closest('.readmore-clamp');
    const expanded = card.classList.toggle('expanded');
    this.textContent = expanded ? 'Read less' : 'Read more';
    this.setAttribute('aria-expanded', expanded);
  });
});
