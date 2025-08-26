// =======================
// HeyDigi - script.js FIX
// =======================

const catalogo = document.getElementById("catalogo");
let datosOriginales = [];

/* --------- Utilidades --------- */
// Parser robusto de CLP (mantiene solo dígitos)
const parseCLP = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

// Genera <li> a partir de "Juegos Incluidos" soportando saltos de línea o comas
const juegosAHTML = (texto) => {
  const html = String(texto ?? "")
    .split(/\r?\n|,/)      // soporta \n, \r\n y también comas
    .map(j => j.trim())
    .filter(Boolean)       // elimina vacíos
    .map(j => `<li>${j}</li>`)
    .join("");
  return html || "<li><em>Sin juegos listados</em></li>";
};

// Consolas robustas (filtra vacíos/espacios)
const consolasAHTML = (texto) => {
  const html = String(texto ?? "")
    .split(",")
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => `<span class="badge-console">${c}</span>`)
    .join(" ");
  return html || '<span class="badge-console">No especificada</span>';
};

/* --------- Render principal --------- */
function mostrarPacks(packs) {
  catalogo.innerHTML = "";
  packs.forEach(pack => {
    const precioNum = parseCLP(pack["Precio CLP"]);
    const tienePrecio = Number.isFinite(precioNum);
    const tieneConsola = String(pack["Consola"] || "").trim() !== "";
    if (!tienePrecio || !tieneConsola) return;

    const div = document.createElement("div");
    div.className = "pack";

    const consolas = consolasAHTML(pack["Consola"]);
    const juegosHTML = juegosAHTML(pack["Juegos Incluidos"]);
    const packData = encodeURIComponent(JSON.stringify(pack));

    div.innerHTML = `
      <h2>Pack N°${pack["Pack ID"]}</h2>
      <p><strong>Juegos incluidos:</strong></p>
      <ul>${juegosHTML}</ul>

      <div class="compatibilidad">
        <h4>Compatibilidad</h4>
        ${consolas}
      </div>

      <div class="seccion-precio-boton">
        <div class="info-precio">
          <h4>Precio</h4>
          <p class="precio">$${precioNum.toLocaleString("es-CL")} CLP</p>
        </div>
        <a href="#" class="btn-wsp" data-pack='${packData}'>
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" class="wsp-icon">
          Comprar
        </a>
      </div>
    `;
    catalogo.appendChild(div);
  });

  // Reajusta padding por si el contenido cambia flujo
  actualizarPaddingPorBarra();
}

/* --------- Carga de datos --------- */
Papa.parse(
  "https://docs.google.com/spreadsheets/d/1hXZx9sG7s8eJCt8jcsowCjHs9AAZI--_4LflZo1tRE0/gviz/tq?tqx=out:csv&gid=1135075618",
  {
    download: true,
    header: true,
    complete: function (results) {
      datosOriginales = results.data;
      mostrarPacks(datosOriginales);
      cargarOpcionesConsola();
    }
  }
);

function cargarOpcionesConsola() {
  const selectConsola = document.getElementById("filtroConsola");
  const consolasUnicas = new Set();

  datosOriginales.forEach(pack => {
    const consola = pack["Consola"] || "";
    consola.split(",").forEach(c => {
      const limpia = c.trim();
      if (limpia) consolasUnicas.add(limpia);
    });
  });

  selectConsola.innerHTML = `<option value="">Todas</option>`;
  [...consolasUnicas].sort().forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    selectConsola.appendChild(opt);
  });
}

/* --------- UI: barra de búsqueda, filtros y safe-area --------- */
document.addEventListener("DOMContentLoaded", () => {
  const lupa = document.getElementById("searchIcon");
  const barra = document.getElementById("barraFlotante");
  const aplicarBtn = document.getElementById("aplicarFiltros");
  const limpiarBtn = document.getElementById("limpiarFiltros");

  // Toggle de la barra (y reajuste de padding)
  document.addEventListener("click", (e) => {
    const esLupa = !!(lupa && lupa.contains(e.target));
    const esDentroNavbar = !!(barra && barra.contains(e.target));

    if (esLupa) {
      barra.classList.toggle("expandido");
      actualizarPaddingPorBarra();
    } else if (!esDentroNavbar) {
      barra.classList.remove("expandido");
      actualizarPaddingPorBarra();
    }
  });

  // Filtros
  aplicarBtn?.addEventListener("click", () => {
    const nombre = document.getElementById("filtroNombre").value.toLowerCase();
    const consola = document.getElementById("filtroConsola").value.toLowerCase();
    const precio = parseInt(document.getElementById("filtroPrecio").value);

    const filtrados = datosOriginales.filter(pack => {
      const juegos = String(pack["Juegos Incluidos"] || "").toLowerCase();
      const consolaTexto = String(pack["Consola"] || "").toLowerCase();
      const precioNum = parseCLP(pack["Precio CLP"]);
      const tienePrecio = Number.isFinite(precioNum);
      const tieneConsola = consolaTexto.trim() !== "";
      const precioValido = isNaN(precio) || precioNum <= precio;

      const palabrasClave = nombre.split(" ").filter(p => p.trim() !== "");
      const nombreIncluye = palabrasClave.every(palabra =>
        juegos.includes(palabra) || String(pack["Pack ID"]).includes(palabra)
      );

      const consolaIncluye = consola === "" || consolaTexto.includes(consola);

      return nombreIncluye && consolaIncluye && precioValido && tieneConsola && tienePrecio;
    });

    mostrarPacks(filtrados);
    barra.classList.remove("expandido");
    actualizarPaddingPorBarra();
  });

  limpiarBtn?.addEventListener("click", () => {
    document.getElementById("filtroNombre").value = "";
    document.getElementById("filtroConsola").value = "";
    document.getElementById("filtroPrecio").value = "";
    mostrarPacks(datosOriginales);
    actualizarPaddingPorBarra();
  });

  // Observa cambios de clase (expandido/colapsado) para recalcular padding
  if (barra) {
    const obs = new MutationObserver(actualizarPaddingPorBarra);
    obs.observe(barra, { attributes: true, attributeFilter: ["class"] });
  }

  // Ajusta al cargar y al redimensionar
  window.addEventListener("load", actualizarPaddingPorBarra);
  window.addEventListener("resize", actualizarPaddingPorBarra);
});

/* --------- Delegación: botón WhatsApp --------- */
document.addEventListener("click", function (e) {
  const btn = e.target.closest(".btn-wsp");
  if (!btn) return;
  e.preventDefault();

  const pack = JSON.parse(decodeURIComponent(btn.getAttribute("data-pack")));
  const mensaje =
    `Hola! 👋 Me interesa el Pack N°${pack["Pack ID"]} que vi en la página.\n\n` +
    `Juegos incluidos:\n${pack["Juegos Incluidos"]}\n\n` +
    `Precio: $${parseCLP(pack["Precio CLP"]).toLocaleString("es-CL")} CLP`;

  const numeroWsp = "56941347576";
  const link = `https://wa.me/${numeroWsp}?text=${encodeURIComponent(mensaje)}`;
  window.open(link, "_blank");
});

/* --------- Layout: calcula padding según altura real de la barra --------- */
// El safe-area (notch) lo maneja CSS con env(safe-area-inset-top).
function actualizarPaddingPorBarra() {
  const barra = document.querySelector('.navbar-content');
  const main  = document.querySelector('main');
  if (!barra || !main) return;
  main.style.paddingTop = `${barra.offsetHeight}px`;
}