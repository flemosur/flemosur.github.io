(function () {
	'use strict';
	var doc = document.documentElement;
	var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

	// Entrada del hero
	requestAnimationFrame(function () { requestAnimationFrame(function () { doc.classList.add('loaded'); }); });

	// Hora local de San Martín de los Andes
	function tick() {
		var t = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Salta' }).format(new Date());
		document.querySelectorAll('[data-clock]').forEach(function (el) { el.textContent = t + ' ART'; });
	}
	tick(); setInterval(tick, 30000);
	var y = document.querySelector('[data-year]'); if (y) y.textContent = new Date().getFullYear();

	// Menú
	var btn = document.querySelector('.menu-btn');
	var menu = document.getElementById('menu');
	function setMenu(open) {
		doc.classList.toggle('menu-open', open);
		btn.setAttribute('aria-expanded', open);
		btn.querySelector('.menu-label').textContent = open ? 'Cerrar' : 'Menú';
		if (open) { menu.hidden = false; menu.querySelector('a').focus({ preventScroll: true }); }
		else { setTimeout(function () { if (!doc.classList.contains('menu-open')) menu.hidden = true; }, 700); }
	}
	btn.addEventListener('click', function () { setMenu(!doc.classList.contains('menu-open')); });
	menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && doc.classList.contains('menu-open')) { setMenu(false); btn.focus(); } });

	// Texto que se ilumina palabra por palabra
	var lits = [].slice.call(document.querySelectorAll('.lit'));
	lits.forEach(function (el) {
		el.innerHTML = el.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
	});

	// Revelado al entrar en pantalla
	var revealSel = '.block .label, .display-md, .body-text, .col, .techniques li, .case, .bear, .chips, .foot-grid > div';
	var io = new IntersectionObserver(function (entries) {
		entries.forEach(function (en) {
			if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
		});
	}, { rootMargin: '0px 0px -12% 0px' });
	if (!reduce) {
		document.querySelectorAll(revealSel).forEach(function (el, i) {
			el.classList.add('reveal');
			if (el.matches('.techniques li')) el.style.transitionDelay = ((i % 10) * 40) + 'ms';
			io.observe(el);
		});
	}
	document.querySelectorAll('.strike').forEach(function (el) { io.observe(el); });

	// Scroll: palabras iluminadas, CTA que se rellena
	var cta = document.querySelectorAll('.cta-line > span');
	var ticking = false;
	function onScroll() {
		ticking = false;
		var vh = window.innerHeight;
		lits.forEach(function (el) {
			var r = el.getBoundingClientRect();
			var p = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
			p = Math.max(0, Math.min(1, p));
			var ws = el.children, n = ws.length;
			for (var i = 0; i < n; i++) {
				var o = Math.max(0.14, Math.min(1, (p * n - i) + 0.14));
				ws[i].style.setProperty('--o', o.toFixed(2));
			}
		});
		cta.forEach(function (el, i) {
			var r = el.getBoundingClientRect();
			var p = (vh * 0.95 - r.top) / (vh * 0.55);
			p = Math.max(0, Math.min(1, p - i * 0.15));
			el.style.setProperty('--fill', (p * 100).toFixed(1) + '%');
		});
	}
	// Cabecera: se oculta al bajar y vuelve al subir
	var top = document.querySelector('.top'), lastY = window.scrollY;
	window.addEventListener('scroll', function () {
		var yy = window.scrollY;
		if (!doc.classList.contains('menu-open')) top.classList.toggle('hide', yy > lastY && yy > 160);
		lastY = yy;
	}, { passive: true });

	if (!reduce) {
		window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
		window.addEventListener('resize', onScroll);
		onScroll();
	}

	// Casos: acordeón
	document.querySelectorAll('.case-head').forEach(function (head) {
		head.addEventListener('click', function () {
			var c = head.parentElement, open = !c.classList.contains('open');
			c.classList.toggle('open', open);
			head.setAttribute('aria-expanded', open);
			hidePreview();
		});
	});

	// Casos: vista previa que sigue al cursor + cursor personalizado
	var cursor = document.querySelector('.cursor');
	var preview = document.querySelector('.preview');
	var pimg = preview.querySelector('img');
	var px = 0, py = 0, tx = 0, ty = 0, raf = null;
	function hidePreview() { preview.classList.remove('show'); }
	if (finePointer) {
		window.addEventListener('pointermove', function (e) {
			tx = e.clientX; ty = e.clientY;
			cursor.style.setProperty('--cx', tx + 'px');
			cursor.style.setProperty('--cy', ty + 'px');
			if (!raf) raf = requestAnimationFrame(follow);
		}, { passive: true });
		function follow() {
			raf = null;
			var dx = tx - px; px += dx * 0.18; py += (ty - py) * 0.18;
			preview.style.setProperty('--x', (px + 28) + 'px');
			preview.style.setProperty('--y', (py - 100) + 'px');
			preview.style.setProperty('--r', Math.max(-8, Math.min(8, dx * 0.08)).toFixed(2) + 'deg');
			if (Math.abs(tx - px) > 0.5 || Math.abs(ty - py) > 0.5) raf = requestAnimationFrame(follow);
		}
		document.querySelectorAll('.case').forEach(function (c) {
			var head = c.querySelector('.case-head');
			head.addEventListener('pointerenter', function () {
				if (c.classList.contains('open')) return;
				pimg.src = c.dataset.preview; preview.classList.add('show');
			});
			head.addEventListener('pointerleave', hidePreview);
		});
		document.querySelectorAll('.case-head, .gallery a, .cta').forEach(function (el) {
			el.addEventListener('pointerenter', function () {
				cursor.querySelector('span').textContent = el.matches('.case-head') ? (el.parentElement.classList.contains('open') ? 'Cerrar' : 'Abrir') : el.matches('.cta') ? 'Llamar' : 'Ver';
				cursor.classList.add('big');
			});
			el.addEventListener('pointerleave', function () { cursor.classList.remove('big'); });
		});
	}

	// Visor de imágenes
	var lb = document.querySelector('.lightbox');
	var lbImg = lb.querySelector('img'), lbCap = lb.querySelector('figcaption');
	var set = [], idx = 0;
	function show(i) {
		idx = (i + set.length) % set.length;
		var a = set[idx];
		lbImg.src = a.getAttribute('href');
		lbImg.alt = a.querySelector('img').alt;
		lbCap.textContent = a.closest('.case').querySelector('.case-title').textContent.trim() + ' · ' + a.querySelector('img').alt + ' · ' + (idx + 1) + '/' + set.length;
	}
	document.querySelectorAll('.gallery a').forEach(function (a) {
		a.addEventListener('click', function (e) {
			if (!lb.showModal) return;
			e.preventDefault();
			set = [].slice.call(a.closest('.gallery').querySelectorAll('a'));
			show(set.indexOf(a));
			lb.showModal();
		});
	});
	lb.querySelector('.lb-close').addEventListener('click', function () { lb.close(); });
	lb.querySelector('.prev').addEventListener('click', function () { show(idx - 1); });
	lb.querySelector('.next').addEventListener('click', function () { show(idx + 1); });
	lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
	lb.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowLeft') show(idx - 1);
		if (e.key === 'ArrowRight') show(idx + 1);
	});
})();
