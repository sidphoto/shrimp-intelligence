let homeScheduled = false;

function isTodayRoute() {
  return (location.hash || '#/today').startsWith('#/today');
}

function markCard(card, className) {
  if (card) card.classList.add(className);
  return card;
}

function enhanceHomeDashboard() {
  if (!isTodayRoute()) {
    document.body.classList.remove('home-dashboard-active');
    return;
  }

  const content = document.querySelector('.content');
  if (!content || content.dataset.homeDashboardLayout) return;

  const heroGrid = content.querySelector(':scope > .hero-grid');
  const hero = heroGrid?.querySelector(':scope > .hero');
  const insightGrid = heroGrid?.querySelector(':scope > .grid');
  const primaryCards = [...content.querySelectorAll(':scope > section.card')];
  const top5 = primaryCards[0];
  const myRadar = primaryCards[1];
  const lowerGrid = content.querySelector(':scope > .lower-grid');
  const topicGrid = content.querySelector(':scope > .topic-grid');
  const topicHeading = topicGrid?.previousElementSibling?.classList.contains('section-title')
    ? topicGrid.previousElementSibling
    : null;

  if (!heroGrid || !hero || !top5) return;

  content.dataset.homeDashboardLayout = 'v1';
  content.classList.add('home-dashboard');
  document.body.classList.add('home-dashboard-active');

  heroGrid.classList.add('home-hero-grid');
  hero.classList.add('home-hero-card');
  markCard(top5, 'home-top5');
  markCard(myRadar, 'home-personal-radar');

  if (insightGrid) {
    insightGrid.classList.add('home-insight-grid');
    const insightCards = [...insightGrid.children];
    markCard(insightCards[0], 'home-emerging-card');
    markCard(insightCards[1], 'home-impact-card');
    top5.after(insightGrid);
  }

  if (lowerGrid) {
    lowerGrid.classList.add('home-lower-grid');
    const cards = [...lowerGrid.children];
    const focus = markCard(cards[0], 'home-focus-card');
    const market = markCard(cards[1], 'home-market-card');
    const taiwan = markCard(cards[2], 'home-taiwan-card');

    if (taiwan && market && focus) {
      lowerGrid.replaceChildren(taiwan, market, focus);
    }

    (insightGrid || top5).after(lowerGrid);
  }

  if (myRadar) {
    (lowerGrid || insightGrid || top5).after(myRadar);
  }

  if (topicHeading && topicGrid && myRadar) {
    myRadar.after(topicHeading, topicGrid);
    topicHeading.classList.add('home-topics-heading');
    topicGrid.classList.add('home-topic-grid');
  }

  content.querySelectorAll('.section-title').forEach(title => title.classList.add('home-section-title'));
}

function scheduleHomeDashboard() {
  if (homeScheduled) return;
  homeScheduled = true;
  queueMicrotask(() => {
    homeScheduled = false;
    enhanceHomeDashboard();
  });
}

new MutationObserver(scheduleHomeDashboard).observe(document.querySelector('#app'), {childList:true, subtree:true});
window.addEventListener('hashchange', scheduleHomeDashboard);
window.addEventListener('popstate', scheduleHomeDashboard);
scheduleHomeDashboard();
