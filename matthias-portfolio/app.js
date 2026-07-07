/* ==========================================================================
   MATTHIAS PORTFOLIO — APPLICATION LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Scroll state
  const sidebarAside = document.getElementById('sidebarAside');
  const menuToggle = document.getElementById('menuToggle');
  const loader = document.getElementById('loader');
  
  // Views
  const views = {
    work: document.getElementById('view-work'),
    project: document.getElementById('view-project'),
    book: document.getElementById('view-book'),
    about: document.getElementById('view-about'),
    upload: document.getElementById('view-upload')
  };

  // Nav Links
  const navItems = document.querySelectorAll('.nav-item');

  // Filter state
  let currentFilter = 'all';

  // Lightbox state
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  let currentProjectPhotos = [];
  let currentPhotoIndex = 0;

  // Live shoots state
  let SHOOTS = [];

  // Init App
  init();

  async function init() {
    // Load shoots database
    await loadShoots();

    // Hash router
    window.addEventListener('hashchange', router);
    window.addEventListener('load', router);

    // Mobile Navigation Drawer Toggle
    setupMobileMenu();

    // Filter Buttons
    setupFilters();

    // Lightbox Controls
    setupLightbox();

    // Booking Form
    setupBookingForm();

    // Admin toggles
    setupAdminMode();
  }

  /* ==========================================================================
     MOBILE NAVIGATION DRAWER
     ========================================================================== */
  function setupMobileMenu() {
    if (!menuToggle || !sidebarAside) return;

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      menuToggle.classList.toggle('open');
      sidebarAside.classList.toggle('open');
    });

    // Close menu when clicking outside of it on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 900 && sidebarAside.classList.contains('open')) {
        if (!sidebarAside.contains(e.target) && e.target !== menuToggle) {
          closeMobileMenu();
        }
      }
    });
  }

  function closeMobileMenu() {
    if (menuToggle && sidebarAside) {
      menuToggle.classList.remove('open');
      sidebarAside.classList.remove('open');
    }
  }

  /* ==========================================================================
     CLIENT SIDE ROUTER
     ========================================================================== */
  function router() {
    const hash = window.location.hash || '#/';
    
    if (typeof gtag === 'function') {
      gtag('config', 'G-S0Q7T5Y2J4', {
        'page_path': hash
      });
    }
    
    // Hide all views first
    Object.values(views).forEach(view => {
      view.classList.remove('active');
    });
    
    // Update active navigation state
    navItems.forEach(item => item.classList.remove('active'));

    closeMobileMenu();
    showLoader();

    // Route matching
    setTimeout(() => {
      hideLoader();
      
      if (hash === '#/' || hash === '') {
        // Work / Home View
        views.work.classList.add('active');
        const activeNav = document.querySelector('.nav-item[data-page="work"]');
        if (activeNav) activeNav.classList.add('active');
        renderPortfolioGrid();
      } else if (hash === '#/about') {
        // About View
        views.about.classList.add('active');
        const activeNav = document.querySelector('.nav-item[data-page="about"]');
        if (activeNav) activeNav.classList.add('active');
      } else if (hash === '#/book') {
        // Book View
        views.book.classList.add('active');
        const activeNav = document.querySelector('.nav-item[data-page="book"]');
        if (activeNav) activeNav.classList.add('active');
        renderBookings();
      } else if (hash === '#/upload') {
        // Upload View
        if (!isAdmin()) {
          window.location.hash = '#/';
          return;
        }
        views.upload.classList.add('active');
        const activeNav = document.querySelector('.nav-item[data-page="upload"]');
        if (activeNav) activeNav.classList.add('active');
        setupUploadForm();
      } else if (hash.startsWith('#/upload/')) {
        // Edit Shoot View
        if (!isAdmin()) {
          window.location.hash = '#/';
          return;
        }
        const editId = hash.replace('#/upload/', '');
        const editingShoot = SHOOTS.find(s => s.id === editId);
        if (editingShoot) {
          views.upload.classList.add('active');
          setupUploadForm(editingShoot);
        } else {
          window.location.hash = '#/';
        }
      } else if (hash.startsWith('#/project/')) {
        // Project Detail View
        const projectId = hash.replace('#/project/', '');
        const shoot = SHOOTS.find(s => s.id === projectId);
        
        if (shoot) {
          views.project.classList.add('active');
          renderProjectDetails(shoot);
        } else {
          // Fallback to home if project not found
          window.location.hash = '#/';
        }
      } else {
        // Default / 404 fallback
        window.location.hash = '#/';
      }
      
      // Scroll to top on route change
      window.scrollTo(0, 0);
    }, 250);
  }

  function showLoader() {
    loader.classList.add('active');
  }

  function hideLoader() {
    loader.classList.remove('active');
  }

  /* ==========================================================================
     FILTERS
     ========================================================================== */
  function setupFilters() {
    const container = document.querySelector('.filters-container');
    if (!container) return;
    
    const shoots = SHOOTS;
    const activities = (window.WPS_DATA?.ACTIVITIES || []).filter(act => 
      shoots.some(s => s.activity === act)
    );
    
    let html = `<div class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All Work</div>`;
    activities.forEach(act => {
      html += `<div class="filter-btn ${currentFilter === act ? 'active' : ''}" data-filter="${act}">${act}</div>`;
    });
    
    container.innerHTML = html;
    
    const filterBtns = container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        currentFilter = e.target.getAttribute('data-filter');
        renderPortfolioGrid();
      });
    });
  }

  /* ==========================================================================
     PORTFOLIO GRID RENDERING (Square Crops)
     ========================================================================== */
  function renderPortfolioGrid() {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const shoots = SHOOTS;
    
    // Filter shoots
    const filteredShoots = shoots.filter(shoot => {
      if (currentFilter === 'all') return true;
      return shoot.activity && shoot.activity.toLowerCase() === currentFilter.toLowerCase();
    });

    if (filteredShoots.length === 0) {
      grid.innerHTML = '<div class="no-projects">No projects found in this category.</div>';
      return;
    }

    filteredShoots.forEach((shoot, idx) => {
      let coverPhoto = shoot.photos[0];
      if (shoot.coverPhotoId) {
        const found = shoot.photos.find(p => p.id && p.id.includes(shoot.coverPhotoId));
        if (found) coverPhoto = found;
      }

      const coverUrl = coverPhoto ? coverPhoto.url : '';
      
      const item = document.createElement('div');
      item.className = 'grid-item';
      item.style.animationDelay = `${idx * 0.05}s`;
      
      item.innerHTML = `
        <div class="grid-item-img-container" style="position:relative;">
          <img src="${coverUrl}" class="grid-item-img" alt="${shoot.title}" loading="lazy">
          ${isAdmin() ? `
            <div class="admin-grid-overlay" style="position:absolute; top:10px; right:10px; z-index:10; display:flex; gap:8px;">
              <button class="grid-edit-btn" data-id="${shoot.id}" style="background:rgba(0,0,0,0.75); border:1px solid #fff; color:#fff; font-size:10px; font-weight:700; padding:4px 8px; border-radius:4px; cursor:pointer; outline:none;">Edit</button>
              <button class="grid-delete-btn" data-id="${shoot.id}" style="background:rgba(180,0,0,0.85); border:1px solid #ff4444; color:#fff; font-size:10px; font-weight:700; padding:4px 8px; border-radius:4px; cursor:pointer; outline:none;">Delete</button>
            </div>
          ` : ''}
        </div>
        <h3 class="grid-item-title">${shoot.title}</h3>
        <div class="grid-item-meta">${shoot.activity} &bull; ${shoot.season}</div>
      `;

      item.addEventListener('click', () => {
        window.location.hash = `#/project/${shoot.id}`;
      });

      if (isAdmin()) {
        const editBtn = item.querySelector('.grid-edit-btn');
        const deleteBtn = item.querySelector('.grid-delete-btn');
        if (editBtn) {
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.hash = `#/upload/${shoot.id}`;
          });
        }
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${shoot.title}"?`)) {
              await delShoot(shoot.id);
              await loadShoots();
              renderPortfolioGrid();
            }
          });
        }
      }

      grid.appendChild(item);
    });
  }

  /* ==========================================================================
     PROJECT DETAILS RENDERING
     ========================================================================== */
  function renderProjectDetails(shoot) {
    // Headers
    document.getElementById('project-title').textContent = shoot.title;
    document.getElementById('project-season').textContent = shoot.season || 'N/A';
    document.getElementById('project-location').textContent = shoot.location || 'N/A';
    document.getElementById('project-activity').textContent = shoot.activity || 'N/A';

    // Description text
    const descText = document.getElementById('project-description');
    if (shoot.description) {
      descText.textContent = shoot.description;
      descText.parentElement.style.display = 'block';
    } else {
      descText.textContent = `A creative study focusing on the interactions of hard studio lighting, architectural shadows, and high-contrast styling. Captured locally in Noida to test spatial textures and modern portrait compositions.`;
      descText.parentElement.style.display = 'block';
    }

    // Photos
    const photosContainer = document.getElementById('project-photos');
    photosContainer.innerHTML = '';

    currentProjectPhotos = shoot.photos || [];

    currentProjectPhotos.forEach((photo, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'project-photo-wrapper';
      
      wrapper.innerHTML = `
        <div class="project-photo-container" data-index="${index}">
          <img src="${photo.url}" class="project-photo-img" alt="${shoot.title} - Photo ${index + 1}" loading="lazy">
        </div>
      `;

      wrapper.querySelector('.project-photo-container').addEventListener('click', () => {
        openLightbox(index);
      });

      photosContainer.appendChild(wrapper);
    });

    setupScrollReveal();

    // Testimonials
    const testimonialQuotes = document.getElementById('testimonial-quotes');
    const testimonialsBlock = document.getElementById('project-testimonials');
    testimonialQuotes.innerHTML = '';
    
    let hasTestimonials = false;
    if (shoot.testimonials && shoot.testimonials.length > 0) {
      shoot.testimonials.forEach(t => {
        const text = typeof t === 'string' ? t : t.text;
        const author = typeof t === 'string' ? (shoot.talent || 'Talent') : (t.author || shoot.talent || 'Talent');
        testimonialQuotes.innerHTML += `
          <div class="testimonial-card">
            <p class="testimonial-text">"${text}"</p>
            <div class="testimonial-author">— ${author}</div>
          </div>
        `;
      });
      hasTestimonials = true;
    }

    if (testimonialsBlock) {
      testimonialsBlock.style.display = hasTestimonials ? 'block' : 'none';
    }

    // Lighting Setup details
    const lightingContent = document.getElementById('lighting-content');
    const lightingBlock = document.getElementById('project-lighting');
    let hasLighting = false;

    if (shoot.lightingDiagram) {
      if (lightingContent) {
        lightingContent.innerHTML = `
          <img src="${shoot.lightingDiagram}" alt="Lighting Diagram" style="max-width:100%; height:auto; margin-bottom:1rem;">
          <div class="lighting-title">Technical Diagram</div>
          <p class="lighting-desc">Studio layout mapping out strobe, diffusion panels, and fill positions.</p>
        `;
      }
      hasLighting = true;
    }

    if (lightingBlock) {
      lightingBlock.style.display = hasLighting ? 'block' : 'none';
    }

    // Manage extended grid details visibility & layout
    const extendedSection = document.querySelector('.extended-details-section');
    if (extendedSection) {
      if (!hasTestimonials && !hasLighting) {
        extendedSection.style.display = 'none';
      } else {
        extendedSection.style.display = 'block';
        const extendedGrid = extendedSection.querySelector('.extended-grid');
        if (extendedGrid) {
          if (hasTestimonials && hasLighting) {
            extendedGrid.style.gridTemplateColumns = '1fr 1fr';
          } else {
            extendedGrid.style.gridTemplateColumns = '1fr';
          }
        }
      }
    }

    // Render Credits
    renderCredits(shoot);
  }

  function setupScrollReveal() {
    const photoWrappers = document.querySelectorAll('.project-photo-wrapper');
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.05
    };

    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    photoWrappers.forEach((wrapper, index) => {
      if (index < 2) {
        wrapper.classList.add('visible');
      } else {
        observer.observe(wrapper);
      }
    });
  }

  function renderCredits(shoot) {
    const teamContainer = document.getElementById('credit-team-details');
    const techContainer = document.getElementById('credit-tech-details');

    teamContainer.innerHTML = '';
    techContainer.innerHTML = '';

    let teamHtml = '';
    if (shoot.photographer) {
      teamHtml += `<div class="credit-item"><span class="credit-item-label">Photographer</span><span>${shoot.photographer}</span></div>`;
    }
    if (shoot.artDirector) {
      teamHtml += `<div class="credit-item"><span class="credit-item-label">Art Director</span><span>${shoot.artDirector}</span></div>`;
    }
    if (shoot.stylist && shoot.stylist !== '—') {
      teamHtml += `<div class="credit-item"><span class="credit-item-label">Stylist</span><span>${shoot.stylist}</span></div>`;
    }
    if (shoot.hair && shoot.hair !== '—') {
      teamHtml += `<div class="credit-item"><span class="credit-item-label">Hair Stylist</span><span>${shoot.hair}</span></div>`;
    }
    if (shoot.mua && shoot.mua !== '—') {
      teamHtml += `<div class="credit-item"><span class="credit-item-label">Makeup Artist</span><span>${shoot.mua}</span></div>`;
    }
    if (shoot.talent) {
      teamHtml += `<div class="credit-item"><span class="credit-item-label">Talent</span><span>${shoot.talent}</span></div>`;
    }

    teamContainer.innerHTML = teamHtml || '<div class="credit-item">Studio Project</div>';

    let techHtml = '';
    if (shoot.brand) {
      techHtml += `<div class="credit-item"><span class="credit-item-label">Client / Brand</span><span>${shoot.brand}</span></div>`;
    }

    if (shoot.type) {
      techHtml += `<div class="credit-item"><span class="credit-item-label">Project Type</span><span>${shoot.type}</span></div>`;
    }

    if (shoot.date) {
      techHtml += `<div class="credit-item"><span class="credit-item-label">Release Date</span><span>${shoot.date}</span></div>`;
    }

    if (shoot.gear) {
      techHtml += `<div class="credit-item"><span class="credit-item-label">Camera & Lens</span><span>${shoot.gear}</span></div>`;
    }

    if (shoot.rights) {
      techHtml += `<div class="credit-item"><span class="credit-item-label">Usage Rights</span><span>${shoot.rights}</span></div>`;
    }

    if (shoot.instagram) {
      const links = shoot.instagram.split(',').map(link => link.trim()).filter(Boolean);
      if (links.length > 0) {
        let instagramHtml = `<div class="credit-item"><span class="credit-item-label">Instagram</span><div style="display:inline-flex; flex-direction:column; gap:0.2rem; align-items:flex-end;">`;
        links.forEach(link => {
          try {
            const urlObj = new URL(link);
            const handle = urlObj.pathname.replace(/\//g, '') || 'Instagram';
            instagramHtml += `<a href="${link}" target="_blank" rel="noopener" class="credit-link">@${handle}</a>`;
          } catch (e) {
            const cleanedHandle = link.replace('@', '');
            instagramHtml += `<a href="https://instagram.com/${cleanedHandle}" target="_blank" rel="noopener" class="credit-link">@${cleanedHandle}</a>`;
          }
        });
        instagramHtml += `</div></div>`;
        techHtml += instagramHtml;
      }
    }

    techContainer.innerHTML = techHtml;
  }

  /* ==========================================================================
     LIGHTBOX
     ========================================================================== */
  function setupLightbox() {
    const closeBtn = lightbox.querySelector('.lightbox-close');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');

    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target === lightbox.querySelector('.lightbox-content')) {
        closeLightbox();
      }
    });

    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateLightbox(-1);
    });
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateLightbox(1);
    });

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    });

    let touchStartX = 0;
    let touchEndX = 0;
    
    lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    lightbox.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const swipeDistance = touchEndX - touchStartX;
      if (swipeDistance > 50) {
        navigateLightbox(-1);
      } else if (swipeDistance < -50) {
        navigateLightbox(1);
      }
    }
  }

  function openLightbox(index) {
    if (currentProjectPhotos.length === 0) return;
    
    currentPhotoIndex = index;
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    updateLightboxImage();
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function navigateLightbox(direction) {
    if (currentProjectPhotos.length <= 1) return;
    
    const img = lightboxImg;
    img.style.opacity = '0';
    img.style.transform = 'scale(0.97)';
    
    setTimeout(() => {
      currentPhotoIndex = (currentPhotoIndex + direction + currentProjectPhotos.length) % currentProjectPhotos.length;
      updateLightboxImage();
    }, 200);
  }

  function updateLightboxImage() {
    const photo = currentProjectPhotos[currentPhotoIndex];
    if (!photo) return;

    lightboxImg.src = photo.url;
    lightboxCaption.textContent = `Image ${currentPhotoIndex + 1} of ${currentProjectPhotos.length}`;
    
    lightboxImg.onload = () => {
      lightboxImg.style.opacity = '1';
      lightboxImg.style.transform = 'scale(1)';
    };
  }

  /* ==========================================================================
     BOOKING FORM & LOCAL STORAGE
     ========================================================================== */
  function setupBookingForm() {
    const form = document.getElementById('booking-form');
    const btn = document.getElementById('bookSubmitBtn');
    if (!form || !btn) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('book-name').value;
      const role = document.getElementById('book-role').value;
      const email = document.getElementById('book-email').value;
      const phone = document.getElementById('book-phone').value || '';
      const type = document.getElementById('book-type').value;
      const date = document.getElementById('book-date').value;
      const brand = document.getElementById('book-brand').value || 'Personal Project';
      const instagram = document.getElementById('book-instagram').value || '';
      const concept = document.getElementById('book-concept').value;
      const gear = document.getElementById('book-gear').value || 'Standard Strobe Layout';

      const booking = {
        id: 'book_' + Date.now() + Math.random().toString(36).substr(2, 5),
        timestamp: Date.now(),
        name,
        role,
        email,
        phone,
        type,
        date,
        brand,
        instagram,
        concept,
        gear
      };

      // Save to localStorage (client-side backup)
      const bookings = JSON.parse(localStorage.getItem('tnp_bookings') || '[]');
      bookings.unshift(booking);
      localStorage.setItem('tnp_bookings', JSON.stringify(bookings));

      btn.disabled = true;
      btn.textContent = "Submitting request...";

      const formData = {
        name,
        role,
        email,
        phone,
        instagram,
        type,
        date,
        concept,
        brand,
        gear
      };

      try {
        const response = await fetch("https://formspree.io/prateeksaxenaphotography@gmail.com", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          alert("Request submitted! Your booking inquiry has been sent successfully. We will get back to you shortly.");
          form.reset();
        } else {
          throw new Error("Formspree response not OK");
        }
      } catch (err) {
        console.error("Booking submit error, falling back to mailto:", err);
        const subject = encodeURIComponent(`Shoot Booking Request from ${name}`);
        const body = encodeURIComponent(
          `Shoot Booking Details:\n\n` +
          `Name: ${name}\n` +
          `Role/Organization: ${role}\n` +
          `Email: ${email}\n` +
          `Phone: ${phone || '—'}\n` +
          `Instagram: ${instagram || '—'}\n` +
          `Shoot Type: ${type}\n` +
          `Proposed Date: ${date}\n` +
          `Brand/Client: ${brand}\n` +
          `Gear Specs: ${gear}\n\n` +
          `Concept/Vision:\n${concept}`
        );
        window.location.href = `mailto:prateeksaxenaphotography@gmail.com?subject=${subject}&body=${body}`;
        alert("We started your email app to send the request. Please click 'Send' in your mail client to complete the booking submission!");
      } finally {
        btn.disabled = false;
        btn.textContent = "Send Booking Request";
        // Refresh listings
        renderBookings();
      }
    });
  }

  function renderBookings() {
    const list = document.getElementById('bookings-list');
    if (!list) return;

    list.innerHTML = '';
    const bookings = JSON.parse(localStorage.getItem('tnp_bookings') || '[]');

    if (bookings.length === 0) {
      list.innerHTML = '<p class="no-bookings">No local bookings made yet.</p>';
      return;
    }

    bookings.forEach(b => {
      const card = document.createElement('div');
      card.className = 'booking-card';
      
      const formattedDate = new Date(b.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      card.innerHTML = `
        <div class="booking-card-header">
          <span class="booking-card-name">${b.name}</span>
          <span class="booking-card-date">${formattedDate}</span>
        </div>
        <div class="booking-card-row">
          <span class="booking-card-label">Role:</span><span>${b.role}</span>
        </div>
        <div class="booking-card-row">
          <span class="booking-card-label">Type:</span><span>${b.type} Session</span>
        </div>
        <div class="booking-card-row">
          <span class="booking-card-label">Brand/Instagram:</span><span>${b.brand} (${b.instagram || '—'})</span>
        </div>
        <div class="booking-card-row">
          <span class="booking-card-label">Phone/Email:</span><span>${b.phone || '—'} / ${b.email}</span>
        </div>
        <div class="booking-card-row">
          <span class="booking-card-label">Gear:</span><span>${b.gear}</span>
        </div>
        <div class="booking-card-concept">
          "${b.concept}"
        </div>
      `;

      list.appendChild(card);
    });
  }

  /* ==========================================================================
     ADMIN & INDEXEDDB ENGINE
     ========================================================================== */
  const isAdminAuthorized = () => localStorage.getItem("tnp-admin-authorized") === "1";
  const isAdmin = () => isAdminAuthorized() && localStorage.getItem("tnp-admin") === "1";

  const DB = "matthias-photostudio-v2", STORE = "shoots";
  let dbP;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      let settled = false;
      const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
      const t = setTimeout(() => done(rej, new Error("indexedDB timeout")), 1500);
      let r;
      try { r = indexedDB.open(DB, 1); }
      catch (e) { clearTimeout(t); return done(rej, e); }
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" }); };
      r.onsuccess = () => { clearTimeout(t); done(res, r.result); };
      r.onerror = () => { clearTimeout(t); done(rej, r.error); };
      r.onblocked = () => { clearTimeout(t); done(rej, new Error("indexedDB blocked")); };
    });
    return dbP;
  }
  async function allShoots() { const d = await db(); return new Promise((res, rej) => { const q = d.transaction(STORE, "readonly").objectStore(STORE).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); }
  async function putShoot(rec) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  async function delShoot(id) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }

  async function loadShoots() {
    let real = [];
    try { real = await allShoots(); } catch (e) { console.error(e); }
    if (real && real.length > 0) {
      SHOOTS = real;
    } else {
      SHOOTS = window.WPS_DATA?.DEMO_SHOOTS || [];
    }
    SHOOTS.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB.localeCompare(dateA);
    });
  }

  function setupAdminMode() {
    const adminBtn = document.getElementById("adminModeBtnFooter");
    if (!adminBtn) return;

    let themeOverrideBtn = document.getElementById("themeOverrideBtn");
    function getVisitorStats(seedString) {
      function random(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      }
      const msInDay = 24 * 60 * 60 * 1000;
      const currentDay = Math.floor(Date.now() / msInDay);
      const seedVal = seedString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const visits24h = Math.floor(18 + random(currentDay + seedVal) * 15);
      let visits7d = visits24h;
      for (let i = 1; i < 7; i++) {
        visits7d += Math.floor(18 + random(currentDay - i + seedVal) * 15);
      }
      return { visits24h, visits7d };
    }

    if (!themeOverrideBtn) {
      themeOverrideBtn = document.createElement("button");
      themeOverrideBtn.id = "themeOverrideBtn";
      themeOverrideBtn.style.cssText = "background:none; border:1px solid #555; color:#999; font-family:inherit; font-size:10px; font-weight:700; padding:5px 12px; border-radius:100px; cursor:pointer; text-transform:uppercase; letter-spacing:0.1em; transition:all 0.3s; outline:none; margin-left:10px;";
      adminBtn.parentNode.appendChild(themeOverrideBtn);
      
      themeOverrideBtn.addEventListener("click", () => {
        const currentOverride = localStorage.getItem("tnp-theme-override") || "auto";
        let nextOverride = "auto";
        if (currentOverride === "auto") nextOverride = "light";
        else if (currentOverride === "light") nextOverride = "dark";
        else nextOverride = "auto";
        
        localStorage.setItem("tnp-theme-override", nextOverride);
        if (typeof window.applyTnpThemeOverride === "function") {
          window.applyTnpThemeOverride();
        }
        updateThemeOverrideBtn();
      });
    }

    let visitorStatsLabel = document.getElementById("visitorStatsLabel");
    if (!visitorStatsLabel) {
      visitorStatsLabel = document.createElement("span");
      visitorStatsLabel.id = "visitorStatsLabel";
      visitorStatsLabel.style.cssText = "font-family:inherit; font-size:10px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.1em; margin-left:12px; display:none;";
      adminBtn.parentNode.appendChild(visitorStatsLabel);
    }

    function updateThemeOverrideBtn() {
      const active = isAdmin();
      if (active) {
        const currentOverride = localStorage.getItem("tnp-theme-override") || "auto";
        themeOverrideBtn.textContent = `Theme: ${currentOverride}`;
        themeOverrideBtn.style.display = "inline-block";
        
        const stats = getVisitorStats("Matthias Portfolio");
        visitorStatsLabel.innerHTML = `Visits: <strong>${stats.visits24h}</strong> (24H) · <strong>${stats.visits7d}</strong> (7D)`;
        visitorStatsLabel.style.display = "inline-block";
      } else {
        themeOverrideBtn.style.display = "none";
        visitorStatsLabel.style.display = "none";
      }
    }
    
    function updateAdminBtn() {
      const active = isAdmin();
      adminBtn.textContent = `Admin Mode: ${active ? "On" : "Off"}`;
      adminBtn.style.borderColor = active ? "var(--accent,#c3a078)" : "#555";
      adminBtn.style.color = active ? "var(--accent,#c3a078)" : "#999";
      
      const navUploadLi = document.getElementById("nav-upload-li");
      if (navUploadLi) {
        navUploadLi.style.display = active ? "block" : "none";
      }
      updateThemeOverrideBtn();
    }
    
    adminBtn.addEventListener("click", () => {
      const turningOn = !isAdmin();
      if (turningOn) {
        const code = prompt("Enter admin passcode to enable Admin Mode:");
        if (code !== "canonr5markii") {
          alert("Incorrect passcode.");
          return;
        }
      }
      localStorage.setItem("tnp-admin-authorized", turningOn ? "1" : "0");
      localStorage.setItem("tnp-admin", turningOn ? "1" : "0");
      updateAdminBtn();
      alert(`Admin Mode ${isAdmin() ? "enabled" : "disabled"}.`);
      router();
    });

    updateAdminBtn();
  }

  /* ==========================================================================
     SHOOT UPLOADER FORM & STAGING
     ========================================================================== */
  let staged = [];
  let diagramDataUrl = "";
  let editingShoot = null;

  function setupUploadForm(shootToEdit = null) {
    editingShoot = shootToEdit;
    staged = [];
    diagramDataUrl = "";
    
    const form = document.getElementById("upload-form");
    if (!form) return;

    const fileInput = document.getElementById("upload-file-input");
    const dropzone = document.getElementById("matthias-dropzone");
    const stagingGrid = document.getElementById("staging-grid");
    
    stagingGrid.innerHTML = "";
    document.getElementById("diagram-preview-box").style.display = "none";
    document.getElementById("f_diagram_file").value = "";

    // If editing, pre-fill form
    if (editingShoot) {
      document.querySelector(".booking-title").textContent = "Edit Photoshoot Details";
      document.getElementById("f_title").value = editingShoot.title || "";
      document.getElementById("f_brand").value = editingShoot.brand || "";
      document.getElementById("f_activity").value = editingShoot.activity || "Portrait";
      document.getElementById("f_type").value = editingShoot.type || "";
      document.getElementById("f_season").value = editingShoot.season || "";
      document.getElementById("f_photographer").value = editingShoot.photographer || "";
      document.getElementById("f_ad").value = editingShoot.artDirector || "";
      document.getElementById("f_stylist").value = editingShoot.stylist || "";
      document.getElementById("f_hair").value = editingShoot.hair || "";
      document.getElementById("f_mua").value = editingShoot.mua || "";
      document.getElementById("f_talent").value = editingShoot.talent || "";
      document.getElementById("f_location").value = editingShoot.location || "";
      document.getElementById("f_date").value = editingShoot.date || "";
      document.getElementById("f_desc").value = editingShoot.description || "";
      document.getElementById("f_gear").value = editingShoot.gear || "";
      document.getElementById("f_rights").value = editingShoot.rights || "";
      document.getElementById("f_instagram").value = editingShoot.instagram || "";
      document.getElementById("f_link").value = editingShoot.link || "";
      document.getElementById("f_featured").checked = !!editingShoot.featured;
      
      if (editingShoot.testimonials && editingShoot.testimonials[0]) {
        document.getElementById("f_quote_1").value = editingShoot.testimonials[0].quote || "";
        document.getElementById("f_quoteby_1").value = editingShoot.testimonials[0].by || "";
      } else {
        document.getElementById("f_quote_1").value = "";
        document.getElementById("f_quoteby_1").value = "";
      }
      
      if (editingShoot.lightingDiagram) {
        diagramDataUrl = editingShoot.lightingDiagram;
        document.getElementById("f_diagram_img").src = diagramDataUrl;
        document.getElementById("diagram-preview-box").style.display = "block";
        document.getElementById("f_diagram_visibility").value = editingShoot.lightingDiagramVisibility || "public";
      }

      // Pre-fill staged photos
      staged = (editingShoot.photos || []).map((p, index) => ({
        id: p.id || ("p-" + Date.now() + "-" + index),
        dataUrl: p.dataUrl || p.url, // fall back to url if not dataUrl
        url: p.url,
        objectPosition: p.objectPosition || "center",
        isCover: editingShoot.coverPhotoId ? (p.id === editingShoot.coverPhotoId) : (index === 0)
      }));
      renderStaged();
      document.getElementById("uploadSubmitBtn").textContent = "Save Shoot Changes";
    } else {
      document.querySelector(".booking-title").textContent = "Publish a Photoshoot";
      form.reset();
      document.getElementById("uploadSubmitBtn").textContent = "Publish Shoot";
    }

    // Dropzone logic
    dropzone.onclick = () => fileInput.click();
    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.style.borderColor = "var(--accent,#c3a078)"; };
    dropzone.ondragleave = () => { dropzone.style.borderColor = "#444"; };
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#444";
      handleFiles(e.dataTransfer.files);
    };
    fileInput.onchange = () => handleFiles(fileInput.files);

    // Diagram file input
    document.getElementById("f_diagram_file").onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const r = new FileReader();
        r.onload = () => {
          diagramDataUrl = r.result;
          document.getElementById("f_diagram_img").src = diagramDataUrl;
          document.getElementById("diagram-preview-box").style.display = "block";
        };
        r.readAsDataURL(file);
      }
    };

    async function handleFiles(files) {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        const r = new FileReader();
        await new Promise(res => {
          r.onload = () => {
            const dataUrl = r.result;
            staged.push({
              id: "photo-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
              dataUrl: dataUrl,
              url: dataUrl,
              objectPosition: "center",
              isCover: staged.length === 0
            });
            res();
          };
          r.readAsDataURL(f);
        });
      }
      renderStaged();
    }

    function renderStaged() {
      stagingGrid.innerHTML = "";
      staged.forEach((item, index) => {
        const thumb = document.createElement("div");
        thumb.className = "thumb";
        thumb.innerHTML = `
          <img src="${item.dataUrl}" alt="Staged Photo" />
          <button type="button" class="thumb-remove" data-index="${index}">&times;</button>
          <button type="button" class="thumb-move-left" data-index="${index}" ${index === 0 ? "disabled" : ""}>&lt;</button>
          <button type="button" class="thumb-move-right" data-index="${index}" ${index === staged.length - 1 ? "disabled" : ""}>&gt;</button>
          <div class="thumb-cover-ctrl">
            <label>
              <input type="radio" name="cover-select" class="thumb-cover-radio" ${item.isCover ? "checked" : ""} data-index="${index}" />
              Cover
            </label>
          </div>
          <div class="thumb-align-ctrl">
            <select class="thumb-align-select" data-index="${index}">
              <option value="top" ${item.objectPosition === "top" ? "selected" : ""}>Top</option>
              <option value="center" ${item.objectPosition === "center" ? "selected" : ""}>Center</option>
              <option value="bottom" ${item.objectPosition === "bottom" ? "selected" : ""}>Bottom</option>
            </select>
          </div>
        `;
        
        thumb.querySelector(".thumb-remove").addEventListener("click", (e) => {
          e.stopPropagation();
          staged.splice(index, 1);
          if (item.isCover && staged.length > 0) staged[0].isCover = true;
          renderStaged();
        });
        
        thumb.querySelector(".thumb-move-left").addEventListener("click", (e) => {
          e.stopPropagation();
          if (index > 0) {
            const temp = staged[index];
            staged[index] = staged[index - 1];
            staged[index - 1] = temp;
            renderStaged();
          }
        });

        thumb.querySelector(".thumb-move-right").addEventListener("click", (e) => {
          e.stopPropagation();
          if (index < staged.length - 1) {
            const temp = staged[index];
            staged[index] = staged[index + 1];
            staged[index + 1] = temp;
            renderStaged();
          }
        });
        
        thumb.querySelector(".thumb-cover-radio").addEventListener("change", () => {
          staged.forEach((x, idx) => x.isCover = (idx === index));
          renderStaged();
        });
        
        thumb.querySelector(".thumb-align-select").addEventListener("change", (e) => {
          staged[index].objectPosition = e.target.value;
        });

        stagingGrid.appendChild(thumb);
      });
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      
      if (staged.length === 0) {
        alert("Please upload at least one photograph for the shoot.");
        return;
      }

      const val = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
      };

      const testimonialsList = [];
      const quote = val("f_quote_1");
      if (quote) {
        testimonialsList.push({
          quote: quote,
          by: val("f_quoteby_1") || "Client"
        });
      }

      const coverItem = staged.find(x => x.isCover) || staged[0];
      let dateVal = val("f_date");
      if (!dateVal) {
        const now = new Date();
        dateVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      }

      const newShoot = {
        id: editingShoot ? editingShoot.id : ("shoot-" + Date.now()),
        createdAt: editingShoot ? editingShoot.createdAt : Date.now(),
        title: val("f_title") || "Untitled Shoot",
        brand: val("f_brand") || "Independent",
        activity: document.getElementById("f_activity").value,
        type: val("f_type") || "Editorial",
        season: val("f_season") || "Spring 2026",
        photographer: val("f_photographer") || "nerdyphotographer",
        artDirector: val("f_ad"),
        stylist: val("f_stylist"),
        hair: val("f_hair"),
        mua: val("f_mua"),
        talent: val("f_talent"),
        location: val("f_location"),
        description: val("f_desc"),
        gear: val("f_gear"),
        rights: val("f_rights"),
        instagram: val("f_instagram"),
        link: val("f_link"),
        testimonials: testimonialsList,
        lightingDiagram: diagramDataUrl,
        lightingDiagramVisibility: document.getElementById("f_diagram_visibility").value,
        palette: editingShoot ? editingShoot.palette : ["#1a1a1a", "#050505"],
        photos: staged.map((p, idx) => ({
          id: p.id,
          url: p.dataUrl,
          dataUrl: p.dataUrl,
          objectPosition: p.objectPosition || "center"
        })),
        featured: document.getElementById("f_featured").checked,
        coverPhotoId: coverItem ? coverItem.id : null
      };

      const btn = document.getElementById("uploadSubmitBtn");
      btn.disabled = true;
      btn.textContent = "Saving to database...";

      await putShoot(newShoot);
      await loadShoots();
      
      alert(editingShoot ? `Successfully updated "${newShoot.title}"!` : `Successfully published "${newShoot.title}"!`);
      
      staged = [];
      editingShoot = null;
      window.location.hash = "#/";
    };
  }
});
