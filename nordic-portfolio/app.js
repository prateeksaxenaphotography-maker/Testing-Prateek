/* ============================================================
   app.js
   thenerdyphotographer.in — Nordic Editorial Theme Router & logic
   ============================================================ */

(function () {
  'use strict';

  // State Management
  let activeFilter = 'All';
  let activeProjectPhotos = [];
  let currentPhotoIndex = 0;

  // Cache DOM Elements
  const appContainer = document.getElementById('app-container');
  const navLinks = {
    work: document.getElementById('nav-link-work'),
    book: document.getElementById('nav-link-book'),
    about: document.getElementById('nav-link-about'),
    upload: document.getElementById('nav-link-upload')
  };
  const logoLink = document.getElementById('nav-logo');
  const sections = {
    work: document.getElementById('work-view'),
    project: document.getElementById('project-view'),
    book: document.getElementById('book-view'),
    about: document.getElementById('about-view'),
    upload: document.getElementById('upload-view')
  };

  // Lightbox Elements
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
  const lightboxPrevBtn = document.getElementById('lightbox-prev-btn');
  const lightboxNextBtn = document.getElementById('lightbox-next-btn');
  const lightboxCaptionTitle = document.getElementById('lightbox-caption-title');
  const lightboxCaptionIndex = document.getElementById('lightbox-caption-index');

  // Booking Form Elements
  const bookingForm = document.getElementById('booking-form');
  const bookingTypeSelect = document.getElementById('booking-type');
  const bookingBrandSelect = document.getElementById('booking-brand');
  const bookingsListContainer = document.getElementById('bookings-list');
  const bookingDateInput = document.getElementById('booking-date');

  /* ============================================================
     Initialization
     ============================================================ */
  async function init() {
    // Load shoots database
    await loadShoots();

    // Populate form dropdowns from WPS_DATA
    populateDropdowns();
    
    // Setup filter bar activities
    renderFilters();

    // Render initial grid of projects
    renderWorkGrid();

    // Load and render local bookings list
    renderBookingsList();

    // Configure admin modes
    setupAdminMode();

    // Configure date picker minimum limit to today
    const today = new Date().toISOString().split('T')[0];
    if (bookingDateInput) {
       bookingDateInput.min = today;
    }

    // Set about page portrait image
    const aboutImg = document.getElementById('about-portrait-img');
    if (aboutImg) {
      aboutImg.src = 'photos/about_portrait.jpg';
    }

    // Event Listeners
    window.addEventListener('hashchange', handleRoute);
    
    // Scroll container mouse wheel handler (Vertical to Horizontal conversion)
    setupHorizontalWheelScroll();

    // Handle Form Submission
    if (bookingForm) {
      bookingForm.addEventListener('submit', handleBookingSubmit);
    }

    // Lightbox Event Bindings
    setupLightboxListeners();

    // Initial Routing
    handleRoute();
  }

  /* ============================================================
     Router Logic
     ============================================================ */
  function handleRoute() {
    const hash = window.location.hash || '#/';
    
    // Reset document background modifications and body styles
    document.documentElement.style.setProperty('--project-accent-1', '#0a0a0a');
    document.documentElement.style.setProperty('--project-accent-2', '#121212');
    document.body.style.overflow = '';

    // Deactivate all nav links
    Object.values(navLinks).forEach(link => {
      if (link) link.classList.remove('active');
    });

    // Route Switching
    if (hash === '#/') {
      // Work Page
      switchActiveSection('work');
      navLinks.work.classList.add('active');
      renderWorkGrid();
    } else if (hash === '#/upload') {
      // Upload Page
      if (!isAdmin()) {
        window.location.hash = '#/';
        return;
      }
      switchActiveSection('upload');
      if (navLinks.upload) navLinks.upload.classList.add('active');
      setupUploadForm();
    } else if (hash.startsWith('#/upload/')) {
      // Edit Page
      if (!isAdmin()) {
        window.location.hash = '#/';
        return;
      }
      const editId = hash.replace('#/upload/', '');
      const editingShoot = SHOOTS.find(s => s.id === editId);
      if (editingShoot) {
        switchActiveSection('upload');
        if (navLinks.upload) navLinks.upload.classList.add('active');
        setupUploadForm(editingShoot);
      } else {
        window.location.hash = '#/';
      }
    } else if (hash.startsWith('#/project/')) {
      // Project Details Page
      const projectId = hash.replace('#/project/', '');
      const project = findProjectById(projectId);
      if (project) {
        switchActiveSection('project');
        renderProjectDetails(project);
      } else {
        // Redirect to work if project not found
        window.location.hash = '#/';
      }
    } else if (hash === '#/book') {
      // Booking Page
      switchActiveSection('book');
      navLinks.book.classList.add('active');
      renderBookingsList();
    } else if (hash === '#/about') {
      // About Page
      switchActiveSection('about');
      navLinks.about.classList.add('active');
    } else {
      // Catch-all redirect
      window.location.hash = '#/';
    }

    // Scroll window to top on route change
    window.scrollTo(0, 0);
  }

  function switchActiveSection(activeKey) {
    Object.entries(sections).forEach(([key, section]) => {
      if (key === activeKey) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });
  }

  function findProjectById(id) {
    return SHOOTS.find(shoot => shoot.id === id);
  }

  /* ============================================================
     Horizontal Scroll & Filters (Work View)
     ============================================================ */
  function setupHorizontalWheelScroll() {
    const container = document.getElementById('portfolio-grid');
    if (container) {
      container.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          container.scrollLeft += e.deltaY * 1.5;
        }
      }, { passive: false });
    }
  }

  function renderFilters() {
    const filterBar = document.getElementById('filter-bar');
    if (!filterBar) return;

    const shoots = SHOOTS;
    const activeActivities = (window.WPS_DATA?.ACTIVITIES || []).filter(act => 
      shoots.some(s => s.activity === act)
    );
    const activities = ['All', ...activeActivities];
    filterBar.innerHTML = activities.map(activity => {
      const activeClass = activity === activeFilter ? 'active' : '';
      return `<button class="filter-btn ${activeClass}" data-filter="${activity}">${activity}</button>`;
    }).join('');

    // Attach click events
    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        activeFilter = e.target.getAttribute('data-filter');
        // Update active class immediately
        filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Re-render grid with transition
        const grid = document.getElementById('portfolio-grid');
        if (grid) {
          grid.style.opacity = '0';
          setTimeout(() => {
            renderWorkGrid();
            grid.style.opacity = '1';
            grid.scrollLeft = 0; // Reset scroll position
          }, 200);
        }
      });
    });
  }

  function renderWorkGrid() {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    const shoots = SHOOTS.filter(shoot => {
      return activeFilter === 'All' || shoot.activity === activeFilter;
    });

    if (shoots.length === 0) {
      grid.innerHTML = `<div class="empty-state">No projects found for filter: ${activeFilter}</div>`;
      return;
    }

    grid.innerHTML = shoots.map((project, idx) => {
      // Find the cover photo URL safely
      const coverPhoto = project.photos.find(p => p.id.includes(project.coverPhotoId)) || project.photos[0];
      const photoUrl = coverPhoto ? coverPhoto.url : '';
      const photoPos = coverPhoto && coverPhoto.objectPosition ? coverPhoto.objectPosition : 'top center';
      const paddedIndex = String(idx + 1).padStart(2, '0');

      return `
        <a href="#/project/${project.id}" class="portfolio-card" data-id="${project.id}" style="position:relative;">
          <div class="card-img-wrapper">
            <img src="${photoUrl}" alt="${project.title}" class="card-img" style="object-position: ${photoPos}">
          </div>
          <div class="card-info">
            <div class="card-meta">
              <span class="card-index">${paddedIndex}</span>
              <span class="card-activity">${project.activity}</span>
            </div>
            <div class="card-title-row">
              <h3 class="card-title serif-title">${project.title}</h3>
              <span class="card-arrow">→</span>
            </div>
            <span class="card-brand">${project.brand}</span>
          </div>
          ${isAdmin() ? `
            <div class="admin-grid-overlay" style="position:absolute; bottom:10px; right:10px; z-index:10; display:flex; gap:8px;">
              <button class="grid-edit-btn" data-id="${project.id}" style="background:rgba(0,0,0,0.75); border:1px solid #fff; color:#fff; font-size:10px; font-weight:700; padding:4px 8px; border-radius:4px; cursor:pointer; outline:none;">Edit</button>
              <button class="grid-delete-btn" data-id="${project.id}" style="background:rgba(180,0,0,0.85); border:1px solid #ff4444; color:#fff; font-size:10px; font-weight:700; padding:4px 8px; border-radius:4px; cursor:pointer; outline:none;">Delete</button>
            </div>
          ` : ''}
        </a>
      `;
    }).join('');

    if (isAdmin()) {
      grid.querySelectorAll('.grid-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          window.location.hash = `#/upload/${id}`;
        });
      });
      grid.querySelectorAll('.grid-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          const shoot = SHOOTS.find(s => s.id === id);
          if (confirm(`Are you sure you want to delete "${shoot.title}"?`)) {
            await delShoot(id);
            await loadShoots();
            renderWorkGrid();
          }
        });
      });
    }
  }

  /* ============================================================
     Project Details Rendering & Layouts
     ============================================================ */
  function renderProjectDetails(project) {
    const view = document.getElementById('project-view');
    if (!view) return;

    // Apply color palette glow dynamically
    if (project.palette && project.palette.length >= 2) {
      document.documentElement.style.setProperty('--project-accent-1', project.palette[0]);
      document.documentElement.style.setProperty('--project-accent-2', project.palette[1]);
    }

    // Set local reference for lightbox navigation
    activeProjectPhotos = project.photos || [];

    // Find next and previous projects
    const shoots = SHOOTS;
    const currentIndex = shoots.findIndex(s => s.id === project.id);
    const prevProject = shoots[currentIndex - 1] || shoots[shoots.length - 1];
    const nextProject = shoots[currentIndex + 1] || shoots[0];

    // Build Photos Staggered HTML
    let photosHtml = '';
    const layouts = ['layout-full', 'layout-left', 'layout-right', 'layout-center', 'layout-split'];
    let i = 0;
    
    while (i < activeProjectPhotos.length) {
      const patternIndex = i % 5;
      if (patternIndex === 4 && i < activeProjectPhotos.length - 1) {
        // Double column layout split
        const p1 = activeProjectPhotos[i];
        const p2 = activeProjectPhotos[i + 1];
        photosHtml += `
          <div class="layout-split">
            <div class="project-photo-wrapper" data-index="${i}">
              <img src="${p1.url}" alt="${project.title} frame ${i + 1}" loading="lazy">
              <div class="photo-hover-tag">Frame ${i + 1} / Expand</div>
            </div>
            <div class="project-photo-wrapper" data-index="${i + 1}">
              <img src="${p2.url}" alt="${project.title} frame ${i + 2}" loading="lazy">
              <div class="photo-hover-tag">Frame ${i + 2} / Expand</div>
            </div>
          </div>
        `;
        i += 2;
      } else {
        // Single column layout variants
        const layoutClass = layouts[patternIndex];
        const p = activeProjectPhotos[i];
        photosHtml += `
          <div class="${layoutClass}">
            <div class="project-photo-wrapper" data-index="${i}">
              <img src="${p.url}" alt="${project.title} frame ${i + 1}" loading="lazy">
              <div class="photo-hover-tag">Frame ${i + 1} / Expand</div>
            </div>
          </div>
        `;
        i++;
      }
    }

    // Premium fallbacks for Description / Credits / Testimonials
    const fallbackDesc = project.description || `A cinematic editorial photo-story documenting structural form and minimal lighting styles. Created as a ${project.type} project focusing on natural poses, geometric framing, and a custom muted color palette.`;
    const fallbackTestimonial = getTestimonialFallback(project);
    const lightingSpecs = getLightingSpecs(project);
    const lightingSvgStr = generateLightingDiagramSvg(project);

    view.innerHTML = `
      <div class="project-detail-wrapper">
        <div class="project-detail-glow"></div>
        
        <div class="detail-nav-bar">
          <a href="#/" class="back-btn">
            <span>←</span> Back to Work
          </a>
          <div class="project-breadcrumbs">
            Work / <span>${project.title}</span>
          </div>
        </div>

        <header class="project-header">
          <div class="project-meta-top">
            <span class="project-badge">${project.activity}</span>
            <span class="project-season">${project.season || 'June 2026'}</span>
          </div>
          <h1 class="serif-title project-main-title">${project.title}</h1>
          
          <div class="project-meta-grid">
            <div>
              <div class="meta-col-title">Project Type</div>
              <div class="meta-col-value">${project.type}</div>
            </div>
            <div>
              <div class="meta-col-title">Association</div>
              <div class="meta-col-value">${project.brand}</div>
            </div>
            <div>
              <div class="meta-col-title">Location</div>
              <div class="meta-col-value">${project.location || 'Noida Studio'}</div>
            </div>
            <div>
              <div class="meta-col-title">Main Talent</div>
              <div class="meta-col-value">${project.talent || '—'}</div>
            </div>
          </div>
        </header>

        <!-- Vertical Photo Stream -->
        <div class="project-photos-container">
          ${photosHtml}
        </div>

        <!-- Bottom Technical/Editorial Details -->
        <section class="project-bottom-editorial">
          <div class="${(!!fallbackTestimonial || !!project.lightingDiagram) ? 'bottom-editorial-grid' : 'bottom-editorial-grid single-column'}">
            
            <!-- Left Column: Story + Credits -->
            <div class="editorial-left">
              <div class="project-desc-block">
                <h3 class="serif-title credits-title">Concept & Direction</h3>
                <p>${fallbackDesc}</p>
              </div>

              <div class="credits-block">
                <h3 class="serif-title credits-title">Production Credits</h3>
                <div class="credits-list">
                  <div class="credit-item">
                    <span class="credit-role">Photographer</span>
                    <span class="credit-name">${project.photographer || 'Studio'}</span>
                  </div>
                  <div class="credit-item">
                    <span class="credit-role">Art Director</span>
                    <span class="credit-name">${project.artDirector || 'Studio'}</span>
                  </div>
                  <div class="credit-item">
                    <span class="credit-role">Stylist</span>
                    <span class="credit-name">${project.stylist || '—'}</span>
                  </div>
                  <div class="credit-item">
                    <span class="credit-role">Hair & Makeup</span>
                    <span class="credit-name">${project.mua || '—'}</span>
                  </div>
                  <div class="credit-item">
                    <span class="credit-role">Talent Agency</span>
                    <span class="credit-name">${project.talent ? `${project.talent} (Independent)` : '—'}</span>
                  </div>
                  <div class="credit-item">
                    <span class="credit-role">Digital Tech / Retouching</span>
                    <span class="credit-name">Studio Post-Lab</span>
                  </div>
                </div>
                ${renderInstagramCredits(project.instagram)}
              </div>
            </div>

            <!-- Right Column: Testimonial & Lighting Setup -->
            <div class="editorial-right">
              ${fallbackTestimonial ? `
                <div class="testimonial-block">
                  <h3 class="serif-title credits-title">Subject Review</h3>
                  <blockquote class="testimonial-quote">${fallbackTestimonial.text}</blockquote>
                  <div class="testimonial-author">
                    <strong>${fallbackTestimonial.author}</strong>
                    <span>${fallbackTestimonial.role}</span>
                  </div>
                </div>
              ` : ''}

              ${project.lightingDiagram ? `
                <div class="lighting-block">
                  <h3 class="serif-title credits-title">Lighting Setup & Schema</h3>
                  <div class="lighting-diagram-wrapper" style="background:#111; padding:15px; border-radius:4px; border:1px solid #222;">
                    <img src="${project.lightingDiagram}" alt="Lighting Diagram" style="max-width:100%; height:auto;">
                  </div>
                </div>
              ` : ''}
            </div>

          </div>
        </section>

        <!-- Project Footer Navigation Links -->
        <footer class="project-footer-nav">
          <a href="#/project/${prevProject.id}" class="nav-project-btn prev-project">
            <span class="nav-project-label">Previous Project</span>
            <span class="nav-project-title">${prevProject.title}</span>
          </a>
          <a href="#/project/${nextProject.id}" class="nav-project-btn next-project">
            <span class="nav-project-label">Next Project</span>
            <span class="nav-project-title">${nextProject.title}</span>
          </a>
        </footer>

      </div>
    `;

    // Add click events to images for lightbox
    view.querySelectorAll('.project-photo-wrapper').forEach(wrapper => {
      wrapper.addEventListener('click', () => {
        const index = parseInt(wrapper.getAttribute('data-index'), 10);
        openLightbox(index, project.title);
      });
    });
  }

  function renderInstagramCredits(instagramStr) {
    if (!instagramStr) return '';
    const links = instagramStr.split(',').map(url => {
      const cleanUrl = url.trim();
      const username = cleanUrl.replace('https://www.instagram.com/', '@').replace('https://instagram.com/', '@').split('/')[0];
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--text-color-light); border-bottom: 1px solid var(--border-color); padding-bottom: 2px;">${username}</a>`;
    });

    return `
      <div style="margin-top: 1rem; font-family: var(--font-mono); font-size: 0.75rem;">
        <span style="color: var(--text-color-dim); text-transform: uppercase;">Connect:</span> ${links.join(' &nbsp; ')}
      </div>
    `;
  }

  /* ============================================================
     Fallback Data Generators (Aesthetic Polishing)
     ============================================================ */
  function getTestimonialFallback(project) {
    if (project.testimonials && project.testimonials.length > 0) {
      return project.testimonials[0];
    }
    return null;
  }

  function getLightingSpecs(project) {
    // Generate logical high-end studio technical specs based on activity
    if (project.activity === 'Fashion') {
      return {
        keySource: 'Profoto Pro-11 generator (1200Ws)',
        keyModifier: 'Profoto Giant Reflector 240cm',
        fillSource: '120x120cm Silver Beadboard Reflector',
        cameraDevice: 'Phase One XF IQ4 Medium Format',
        focalLength: 'Schneider Kreuznach 80mm LS f/2.8'
      };
    } else if (project.activity === 'Portrait') {
      return {
        keySource: 'Profoto B10X Plus (500Ws)',
        keyModifier: 'Softlight Beauty Dish White 55cm',
        fillSource: 'Matte White Poly V-Flat (Fill bounce)',
        cameraDevice: 'Hasselblad H6D-100c Digital Back',
        focalLength: 'Hasselblad HC 100mm f/2.2'
      };
    } else {
      return {
        keySource: 'Broncolor Scoro 3200 S WiFi',
        keyModifier: 'Para 88 Reflector Modifier',
        fillSource: 'White Foamcore Reflector Panel',
        cameraDevice: 'Fujifilm GFX 100 II Mirrorless',
        focalLength: 'Fujinon GF 110mm f/2 R LM WR'
      };
    }
  }

  function generateLightingDiagramSvg(project) {
    const specs = getLightingSpecs(project);
    let keyModifierName = 'Softbox';
    if (specs.keyModifier.includes('Giant')) keyModifierName = 'Giant 240';
    else if (specs.keyModifier.includes('Dish')) keyModifierName = 'Beauty Dish';
    else if (specs.keyModifier.includes('Para')) keyModifierName = 'Para 88';

    // A detailed SVG diagram representing the lighting setup on studio grid
    return `
      <svg class="lighting-diagram-svg" viewBox="0 0 300 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid-pattern" width="15" height="15" patternUnits="userSpaceOnUse">
            <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
          </pattern>
        </defs>
        
        <!-- Grid Paper Background -->
        <rect width="100%" height="100%" fill="url(#grid-pattern)" rx="4"/>
        <rect width="100%" height="100%" stroke="rgba(255,255,255,0.08)" stroke-width="1" fill="none" rx="4"/>
        
        <!-- Studio Centerline -->
        <line x1="150" y1="15" x2="150" y2="225" stroke="rgba(255,255,255,0.04)" stroke-width="1" stroke-dasharray="2,4"/>
        
        <!-- Subject representation -->
        <circle cx="150" cy="95" r="16" stroke="var(--text-color-light)" stroke-width="1.5" fill="#0d0d0d"/>
        <text x="150" y="100" text-anchor="middle" font-size="8" fill="var(--text-color-light)">[SUBJ]</text>
        
        <!-- Camera representation -->
        <rect x="138" y="185" width="24" height="16" rx="2" stroke="var(--text-color-dim)" stroke-width="1.5" fill="#0d0d0d"/>
        <path d="M 144 185 L 146 179 L 154 179 L 156 185 Z" stroke="var(--text-color-dim)" stroke-width="1.5" fill="#0d0d0d"/>
        <text x="150" y="215" text-anchor="middle" font-size="7" fill="var(--text-color-dim)">CAMERA</text>
        
        <!-- Connecting dashed line camera to subject -->
        <line x1="150" y1="179" x2="150" y2="111" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="3,3"/>
        
        <!-- Key Light source (45 degrees high left) -->
        <circle cx="80" cy="70" r="12" stroke="var(--text-color-light)" stroke-width="1" fill="#0d0d0d"/>
        <text x="80" y="73" text-anchor="middle" font-size="7" fill="var(--text-color-light)">KEY</text>
        <!-- Beam cone from Key Light -->
        <path d="M 90 76 L 132 90 M 86 80 L 134 102" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-dasharray="2,2"/>
        <text x="50" y="55" font-size="7" fill="var(--text-color-dim)">${keyModifierName}</text>
        
        <!-- Reflector / Fill bounce (Right side) -->
        <line x1="210" y1="80" x2="210" y2="110" stroke="var(--text-color-light)" stroke-width="3"/>
        <text x="215" y="98" font-size="7" fill="var(--text-color-dim)">REFLECTOR</text>
        
        <!-- Rim Light or Background light if applicable -->
        <path d="M 195 145 C 190 148, 185 145, 180 142" stroke="var(--text-color-dim)" stroke-width="1.5"/>
        <text x="205" y="152" font-size="7" fill="var(--text-color-dim)">V-FLAT FILL</text>
        
        <!-- Blueprint Scale / Label -->
        <text x="15" y="25" font-size="7" font-weight="bold" fill="var(--text-color-dim)">STUDIO LIGHTING SETUP</text>
        <text x="15" y="225" font-size="6" fill="var(--text-color-dim)">1 sq = 0.5m | PLAN VIEW</text>
      </svg>
    `;
  }

  /* ============================================================
     Fullscreen Lightbox Logic
     ============================================================ */
  function setupLightboxListeners() {
    if (!lightbox) return;

    // Close button
    lightboxCloseBtn.addEventListener('click', closeLightbox);
    
    // Navigation buttons
    lightboxPrevBtn.addEventListener('click', () => navigateLightbox(-1));
    lightboxNextBtn.addEventListener('click', () => navigateLightbox(1));
    
    // Click outside image on backdrop closes lightbox
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
        closeLightbox();
      }
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (lightbox.getAttribute('aria-hidden') === 'false') {
        if (e.key === 'ArrowLeft') {
          navigateLightbox(-1);
        } else if (e.key === 'ArrowRight') {
          navigateLightbox(1);
        } else if (e.key === 'Escape') {
          closeLightbox();
        }
      }
    });
  }

  function openLightbox(index, title) {
    if (!lightbox || !activeProjectPhotos[index]) return;

    currentPhotoIndex = index;
    const photo = activeProjectPhotos[index];

    lightboxImg.src = photo.url;
    lightboxCaptionTitle.textContent = title || 'Portfolio Shot';
    lightboxCaptionIndex.textContent = `${currentPhotoIndex + 1} / ${activeProjectPhotos.length}`;

    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Disable page scrolling
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Restore page scrolling
    // Clear src to prevent flash of old image next time
    setTimeout(() => { lightboxImg.src = ''; }, 300);
  }

  function navigateLightbox(direction) {
    if (activeProjectPhotos.length === 0) return;
    
    let newIndex = currentPhotoIndex + direction;
    if (newIndex >= activeProjectPhotos.length) {
      newIndex = 0; // wrap around
    } else if (newIndex < 0) {
      newIndex = activeProjectPhotos.length - 1; // wrap around
    }

    currentPhotoIndex = newIndex;
    const photo = activeProjectPhotos[newIndex];
    
    // Simple smooth fade effect during source swap
    lightboxImg.style.opacity = '0.3';
    setTimeout(() => {
      lightboxImg.src = photo.url;
      lightboxCaptionIndex.textContent = `${currentPhotoIndex + 1} / ${activeProjectPhotos.length}`;
      lightboxImg.style.opacity = '1';
    }, 150);
  }

  /* ============================================================
     Booking Form & Local Storage Sync
     ============================================================ */
  function populateDropdowns() {
    if (!window.WPS_DATA) return;

    // Types
    if (bookingTypeSelect) {
      bookingTypeSelect.innerHTML = `
        <option value="" disabled selected hidden></option>
        ${window.WPS_DATA.TYPES.map(type => `<option value="${type}">${type}</option>`).join('')}
      `;
    }

    // Brands
    if (bookingBrandSelect) {
      bookingBrandSelect.innerHTML = `
        <option value="" disabled selected hidden></option>
        ${window.WPS_DATA.BRANDS.map(brand => `<option value="${brand}">${brand}</option>`).join('')}
      `;
    }
  }

  function handleBookingSubmit(e) {
    e.preventDefault();
    
    const fields = {
      name: document.getElementById('booking-name'),
      role: document.getElementById('booking-role'),
      email: document.getElementById('booking-email'),
      phone: document.getElementById('booking-phone'),
      type: bookingTypeSelect,
      date: bookingDateInput,
      brand: bookingBrandSelect,
      instagram: document.getElementById('booking-instagram'),
      concept: document.getElementById('booking-concept'),
      gear: document.getElementById('booking-gear')
    };

    let isValid = true;

    // Reset standard error styling
    Object.values(fields).forEach(field => {
      if (field) {
        const parent = field.closest('.form-group');
        if (parent) parent.classList.remove('invalid');
      }
    });

    // Validations
    if (!fields.name.value.trim()) {
      invalidateField(fields.name);
      isValid = false;
    }

    if (!fields.role.value.trim()) {
      invalidateField(fields.role);
      isValid = false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fields.email.value.trim())) {
      invalidateField(fields.email);
      isValid = false;
    }

    if (!fields.type.value) {
      invalidateField(fields.type);
      isValid = false;
    }

    if (!fields.date.value) {
      invalidateField(fields.date);
      isValid = false;
    }

    if (!fields.brand.value) {
      invalidateField(fields.brand);
      isValid = false;
    }

    if (!fields.concept.value.trim()) {
      invalidateField(fields.concept);
      isValid = false;
    }

    if (!isValid) return;

    // Save Booking to LocalStorage (backup copy)
    const newBooking = {
      id: 'bk_' + Date.now() + Math.random().toString(36).substr(2, 5),
      createdAt: Date.now(),
      name: fields.name.value.trim(),
      role: fields.role.value.trim(),
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim(),
      type: fields.type.value,
      date: fields.date.value,
      brand: fields.brand.value,
      instagram: fields.instagram.value.trim(),
      concept: fields.concept.value.trim(),
      gear: fields.gear.value.trim() || 'Not specified'
    };

    const bookings = getBookingsFromStorage();
    bookings.push(newBooking);
    saveBookingsToStorage(bookings);

    // Disable button during submission
    const btn = document.getElementById('submit-booking-btn');
    if (btn) {
      btn.disabled = true;
      const btnText = btn.querySelector('.btn-text');
      if (btnText) btnText.textContent = "Submitting request...";
    }

    const formData = {
      name: newBooking.name,
      role: newBooking.role,
      email: newBooking.email,
      phone: newBooking.phone,
      instagram: newBooking.instagram,
      type: newBooking.type,
      date: newBooking.date,
      concept: newBooking.concept,
      brand: newBooking.brand,
      gear: newBooking.gear
    };

    fetch("https://formspree.io/prateeksaxenaphotography@gmail.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(formData)
    })
    .then(response => {
      if (response.ok) {
        alert("Request submitted! Your booking inquiry has been sent successfully. We will get back to you shortly.");
        showBookingSuccess(newBooking);
      } else {
        throw new Error("Formspree response not OK");
      }
    })
    .catch(err => {
      console.error("Booking submit error, falling back to mailto:", err);
      const subject = encodeURIComponent(`Shoot Booking Request from ${newBooking.name}`);
      const body = encodeURIComponent(
        `Shoot Booking Details:\n\n` +
        `Name: ${newBooking.name}\n` +
        `Role/Organization: ${newBooking.role}\n` +
        `Email: ${newBooking.email}\n` +
        `Phone: ${newBooking.phone || '—'}\n` +
        `Instagram: ${newBooking.instagram || '—'}\n` +
        `Shoot Type: ${newBooking.type}\n` +
        `Proposed Date: ${newBooking.date}\n` +
        `Brand/Client: ${newBooking.brand}\n` +
        `Gear Specs: ${newBooking.gear}\n\n` +
        `Concept/Vision:\n${newBooking.concept}`
      );
      window.location.href = `mailto:prateeksaxenaphotography@gmail.com?subject=${subject}&body=${body}`;
      alert("We started your email app to send the request. Please click 'Send' in your mail client to complete the booking submission!");
      showBookingSuccess(newBooking);
    })
    .finally(() => {
      if (btn) {
        btn.disabled = false;
        const btnText = btn.querySelector('.btn-text');
        if (btnText) btnText.textContent = "Submit Inquiry";
      }
      renderBookingsList();
    });
  }

  function invalidateField(element) {
    if (!element) return;
    const parent = element.closest('.form-group');
    if (parent) {
      parent.classList.add('invalid');
    }
  }

  function showBookingSuccess(booking) {
    const wrapper = bookingForm.parentElement;
    const originalContent = wrapper.innerHTML;

    wrapper.innerHTML = `
      <div class="booking-success-message">
        <div class="success-icon">✓</div>
        <h3 class="serif-title success-title">Request Received</h3>
        <p class="success-text">Thank you, <strong>${booking.name}</strong>. Your inquiry for a <strong>${booking.type}</strong> session on <strong>${formatDateString(booking.date)}</strong> was logged successfully.</p>
        <button id="book-another-btn" class="reset-form-btn">Submit Another Inquiry</button>
      </div>
    `;

    // Bind reload/reset button
    document.getElementById('book-another-btn').addEventListener('click', () => {
      // Revert wrapper content
      wrapper.innerHTML = originalContent;
      // Re-cache and re-initialize form components
      const newForm = document.getElementById('booking-form');
      if (newForm) {
        newForm.addEventListener('submit', handleBookingSubmit);
      }
      // Re-cache select handles
      const bookingTypeSelectNew = document.getElementById('booking-type');
      const bookingBrandSelectNew = document.getElementById('booking-brand');
      const bookingDateInputNew = document.getElementById('booking-date');
      
      // Repopulate selections
      if (bookingTypeSelectNew && window.WPS_DATA) {
        bookingTypeSelectNew.innerHTML = `
          <option value="" disabled selected hidden></option>
          ${window.WPS_DATA.TYPES.map(type => `<option value="${type}">${type}</option>`).join('')}
        `;
      }
      if (bookingBrandSelectNew && window.WPS_DATA) {
        bookingBrandSelectNew.innerHTML = `
          <option value="" disabled selected hidden></option>
          ${window.WPS_DATA.BRANDS.map(brand => `<option value="${brand}">${brand}</option>`).join('')}
        `;
      }
      if (bookingDateInputNew) {
         bookingDateInputNew.min = new Date().toISOString().split('T')[0];
      }
    });
  }

  function getBookingsFromStorage() {
    const stored = localStorage.getItem('nordic_portfolio_bookings');
    return stored ? JSON.parse(stored) : [];
  }

  function saveBookingsToStorage(bookings) {
    localStorage.setItem('nordic_portfolio_bookings', JSON.stringify(bookings));
  }

  function renderBookingsList() {
    if (!bookingsListContainer) return;
    
    const bookings = getBookingsFromStorage();

    if (bookings.length === 0) {
      bookingsListContainer.innerHTML = `<div class="empty-state">No active inquiries submitted yet. Your requests will appear here.</div>`;
      return;
    }

    // Sort bookings: newest inquiries first
    bookings.sort((a, b) => b.createdAt - a.createdAt);

    bookingsListContainer.innerHTML = bookings.map(booking => {
      return `
        <div class="booking-item-card" data-id="${booking.id}">
          <button class="delete-booking-btn" aria-label="Cancel Inquiry" title="Delete Inquiry">&times;</button>
          
          <div class="booking-item-header">
            <h4 class="booking-item-name">${booking.name}</h4>
            <span class="booking-item-date">${formatDateString(booking.date)}</span>
          </div>
          
          <div class="booking-item-details">
            <div>
              <span class="detail-label-mono">Role:</span>
              <span class="detail-val-mono">${booking.role}</span>
            </div>
            <div>
              <span class="detail-label-mono">Type:</span>
              <span class="detail-val-mono">${booking.type}</span>
            </div>
            <div>
              <span class="detail-label-mono">Brand:</span>
              <span class="detail-val-mono">${booking.brand}</span>
            </div>
            <div>
              <span class="detail-label-mono">Insta:</span>
              <span class="detail-val-mono">${booking.instagram || '—'}</span>
            </div>
            <div>
              <span class="detail-label-mono">Contact:</span>
              <span class="detail-val-mono">${booking.phone || '—'} / ${booking.email}</span>
            </div>
          </div>
          
          <div class="booking-item-concept">
            <strong>Concept:</strong> ${booking.concept}
          </div>
          
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-color-dim);">
            <span class="detail-label-mono">Gear:</span> ${booking.gear}
          </div>
        </div>
      `;
    }).join('');

    // Attach delete listeners
    bookingsListContainer.querySelectorAll('.booking-item-card').forEach(card => {
      const deleteBtn = card.querySelector('.delete-booking-btn');
      const id = card.getAttribute('data-id');
      
      deleteBtn.addEventListener('click', () => {
        // Confirm or delete with smooth animation
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        setTimeout(() => {
          let bookings = getBookingsFromStorage();
          bookings = bookings.filter(b => b.id !== id);
          saveBookingsToStorage(bookings);
          renderBookingsList();
        }, 300);
      });
    });
  }

  function formatDateString(dateString) {
    if (!dateString) return '—';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  }

  /* ==========================================================================
     ADMIN & INDEXEDDB ENGINE
     ========================================================================== */
  const isAdminAuthorized = () => localStorage.getItem("tnp-admin-authorized") === "1";
  const isAdmin = () => isAdminAuthorized() && localStorage.getItem("tnp-admin") === "1";

  const DB = "nordic-photostudio-v2", STORE = "shoots";
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

  let SHOOTS = [];

  function setupAdminMode() {
    const adminBtn = document.getElementById("adminModeBtnFooter");
    if (!adminBtn) return;

    let themeOverrideBtn = document.getElementById("themeOverrideBtn");
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

    function updateThemeOverrideBtn() {
      const active = isAdmin();
      if (active) {
        const currentOverride = localStorage.getItem("tnp-theme-override") || "auto";
        themeOverrideBtn.textContent = `Theme: ${currentOverride}`;
        themeOverrideBtn.style.display = "inline-block";
      } else {
        themeOverrideBtn.style.display = "none";
      }
    }
    
    function updateAdminBtn() {
      const active = isAdmin();
      adminBtn.textContent = `Admin Mode: ${active ? "On" : "Off"}`;
      adminBtn.style.borderColor = active ? "var(--accent,#c3a078)" : "#555";
      adminBtn.style.color = active ? "var(--accent,#c3a078)" : "#999";
      
      const navUploadLi = document.getElementById("nav-link-upload");
      if (navUploadLi) {
        navUploadLi.style.display = active ? "inline-block" : "none";
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
      handleRoute();
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
    const dropzone = document.getElementById("nordic-dropzone");
    const stagingGrid = document.getElementById("staging-grid");
    
    stagingGrid.innerHTML = "";
    document.getElementById("diagram-preview-box").style.display = "none";
    document.getElementById("f_diagram_file").value = "";

    // If editing, pre-fill form
    if (editingShoot) {
      document.querySelector(".serif-title").textContent = "Edit Photoshoot Details";
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
      document.querySelector(".serif-title").textContent = "Publish a Photoshoot";
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
        photographer: val("f_photographer") || "Prateek Saxena",
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

  /* ============================================================
     Kick off Execution
     ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
