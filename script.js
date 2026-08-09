const PACKS_SHEET_ID = "1hXZx9sG7s8eJCt8jcsowCjHs9AAZI--_4LflZo1tRE0";
const PACKS_SHEET_GID = "1135075618";
const UNITARIOS_SHEET_ID = PACKS_SHEET_ID;
const UNITARIOS_SHEET_GID = "962598264";
const FAQ_SHEET_ID = PACKS_SHEET_ID;
const FAQ_SHEET_GID = "966234026";
const WHATSAPP_NUMBER = "56941347576";
const ONLINE_PLANS = {
  online: {
    nombre: "Solo online",
    imagen: "assets/nintendo-switch-online.avif",
    precios: { 3: 5000, 6: 10000, 12: 15000 }
  },
  expansion: {
    nombre: "Online + expansión",
    imagen: "assets/nintendo-switch-online-expansion.avif",
    precios: { 3: 10000, 6: 15000, 12: 22000 }
  }
};

let page = "";
let datosOriginales = [];
let ultimoScroll = 0;
let scrollPendiente = false;
let resultadosCatalogo = [];
let cantidadVisibleCatalogo = 0;
let observadorDeEntradas = null;
let solicitudCatalogoActual = 0;
const RESULTADOS_POR_CARGA = 24;
const catalogCache = {
  packs: null,
  unitarios: null
};

const catalogMeta = {
  packs: {
    note: "Pack de juegos",
    title: "Packs disponibles",
    copy: "Busca tu pack favorito y escríbenos por WhatsApp.",
    helpTitle: "¿Qué son los packs?",
    helpCopy: "Son conjuntos de varios juegos incluidos en una cuenta primaria. Podrás disfrutar distintos títulos desde tu perfil personal de Nintendo Switch.",
    sheetId: PACKS_SHEET_ID,
    gid: PACKS_SHEET_GID,
    emptyTitle: "No hay packs para mostrar",
    emptyCopy: "Prueba limpiando los filtros o revisa que la hoja tenga precio y consola."
  },
  unitarios: {
    note: "Juegos unitarios",
    title: "Juegos disponibles",
    copy: "Busca tu juego favorito y continúa la compra por WhatsApp ;)",
    helpTitle: "¿Qué son los juegos unitarios?",
    helpCopy: "Cada juego se entrega en una cuenta primaria configurada en tu consola, para que puedas jugar directamente desde tu perfil personal de Nintendo Switch.",
    sheetId: UNITARIOS_SHEET_ID,
    gid: UNITARIOS_SHEET_GID,
    emptyTitle: "No hay juegos para mostrar",
    emptyCopy: "Revisa que la hoja tenga nombre y precio para cada juego."
  }
};

const parseCLP = (value) => {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return NaN;
  const number = Number(digits);
  return Number.isFinite(number) ? number : NaN;
};

const normalizarBusqueda = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function distanciaDeEdicion(origen, destino) {
  const filas = origen.length + 1;
  const columnas = destino.length + 1;
  const matriz = Array.from({ length: filas }, (_, fila) => [fila]);

  for (let columna = 0; columna < columnas; columna += 1) matriz[0][columna] = columna;

  for (let fila = 1; fila < filas; fila += 1) {
    for (let columna = 1; columna < columnas; columna += 1) {
      const reemplazo = matriz[fila - 1][columna - 1] + (origen[fila - 1] === destino[columna - 1] ? 0 : 1);
      const insercion = matriz[fila][columna - 1] + 1;
      const eliminacion = matriz[fila - 1][columna] + 1;
      let distancia = Math.min(reemplazo, insercion, eliminacion);

      if (
        fila > 1 && columna > 1 &&
        origen[fila - 1] === destino[columna - 2] &&
        origen[fila - 2] === destino[columna - 1]
      ) {
        distancia = Math.min(distancia, matriz[fila - 2][columna - 2] + 1);
      }

      matriz[fila][columna] = distancia;
    }
  }

  return matriz[filas - 1][columnas - 1];
}

function coincideBusqueda(texto, palabra) {
  if (texto.includes(palabra)) return true;
  if (palabra.length < 5) return false;

  const tolerancia = palabra.length >= 9 ? 2 : 1;
  return texto.split(" ").some((termino) =>
    Math.abs(termino.length - palabra.length) <= tolerancia &&
    distanciaDeEdicion(termino, palabra) <= tolerancia
  );
}

const escapeHTML = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const obtenerJuegos = (texto) =>
  String(texto ?? "")
    .split(/\r?\n|,/)
    .map((juego) => juego.trim())
    .filter(Boolean);

const juegosAHTML = (texto, limite = 6) => {
  const juegos = obtenerJuegos(texto);
  const visibles = juegos.slice(0, limite);
  const restantes = Math.max(juegos.length - visibles.length, 0);
  const items = visibles
    .map((juego) => `<li>${escapeHTML(juego)}</li>`)
    .join("");

  if (!items) return "<li><em>Sin juegos listados</em></li>";
  return `${items}${restantes ? `<li class="more-games">+${restantes} juegos mas</li>` : ""}`;
};

const consolasAHTML = (texto) => {
  const items = String(texto ?? "")
    .split(",")
    .map((consola) => consola.trim())
    .filter(Boolean)
    .map((consola) => `<span class="badge-console">${escapeHTML(consola)}</span>`)
    .join(" ");

  return items || '<span class="badge-console">No especificada</span>';
};

function getCampo(item, nombres) {
  for (const nombre of nombres) {
    if (item[nombre] !== undefined && String(item[nombre]).trim() !== "") {
      return item[nombre];
    }
  }
  return "";
}

function normalizarItem(row, tipo = page) {
  const esUnitario = tipo === "unitarios";
  const precioBase = getCampo(row, ["Precio CLP", "Precio", "Precio final"]);

  return {
    id: getCampo(row, ["Pack ID", "ID", "Id", "id"]),
    juegos: getCampo(row, ["Juegos Incluidos", "Juegos", "Juego", "Nombre", "NOMBRE DE JUEGOS"]),
    precio: precioBase,
    consola: getCampo(row, ["Consola", "Compatibilidad"]) || (esUnitario ? "Nintendo Switch" : ""),
    espacio: getCampo(row, ["Espacio necesario", "Espacio", "Tamaño"]),
    imagen: getCampo(row, ["imagen", "Imagen", "image"]),
    esUnitario,
    raw: row
  };
}

function actualizarResumenCatalogo(unitarios, packs) {
  const cantidadUnitarios = document.getElementById("cantidadUnitarios");
  const cantidadPacks = document.getElementById("cantidadPacks");
  const contarPublicados = (items, tipo) => items
    .map((item) => normalizarItem(item, tipo))
    .filter((item) => item.juegos && Number.isFinite(parseCLP(item.precio)))
    .length;

  if (cantidadUnitarios) {
    cantidadUnitarios.textContent = contarPublicados(unitarios, "unitarios").toLocaleString("es-CL");
  }
  if (cantidadPacks) {
    cantidadPacks.textContent = contarPublicados(packs, "packs").toLocaleString("es-CL");
  }
}

async function cargarOfertasInicio() {
  const contenedor = document.getElementById("ofertasInicio");
  if (!contenedor) return;

  try {
    const [datos, packs] = await Promise.all([
      catalogCache.unitarios || cargarGoogleSheetJSONP(catalogMeta.unitarios),
      catalogCache.packs || cargarGoogleSheetJSONP(catalogMeta.packs)
    ]);
    catalogCache.unitarios = datos;
    catalogCache.packs = packs;
    actualizarResumenCatalogo(datos, packs);

    const recientes = datos
      .map((row) => normalizarItem(row, "unitarios"))
      .filter((item) => Number.isFinite(parseCLP(item.precio)) && /^https?:\/\//i.test(String(item.imagen)))
      .slice(-6)
      .reverse()
      .slice(0, 6);

    if (recientes.length === 0) throw new Error("No hay juegos con imagen.");

    contenedor.innerHTML = recientes.map((item) => {
      const precio = parseCLP(item.precio).toLocaleString("es-CL");
      return `
        <a class="game-tile" href="#unitarios" data-view-link="unitarios">
          <span class="cover-art"><img src="${escapeHTML(item.imagen)}" alt="Portada de ${escapeHTML(item.juegos)}" loading="lazy" decoding="async"></span>
          <h2>${escapeHTML(item.juegos)}</h2>
          <p><strong>$${precio} <span class="clp-flag">CLP</span></strong></p>
        </a>
      `;
    }).join("");
    animarEntradas(contenedor.querySelectorAll(".game-tile"));
  } catch (error) {
    console.error("Error cargando ofertas de inicio", error);
    contenedor.innerHTML = '<p class="offers-error">No pudimos cargar los juegos recientes.</p>';
  }
}

async function cargarPreguntasFrecuentes() {
  const lista = document.getElementById("listaPreguntas");
  if (!lista) return;

  try {
    const datos = await cargarGoogleSheetJSONP({ sheetId: FAQ_SHEET_ID, gid: FAQ_SHEET_GID });
    const preguntas = datos
      .map((fila) => ({
        pregunta: String(fila.Pregunta ?? "").trim(),
        respuesta: String(fila.Respuesta ?? "").trim(),
        activa: normalizarBusqueda(fila.Activa),
        orden: Number(String(fila.Orden ?? "").replace(",", "."))
      }))
      .filter((item) => item.pregunta && item.respuesta && ["si", "true", "1", "activo", "activa"].includes(item.activa))
      .sort((a, b) => {
        const ordenA = Number.isFinite(a.orden) ? a.orden : Number.MAX_SAFE_INTEGER;
        const ordenB = Number.isFinite(b.orden) ? b.orden : Number.MAX_SAFE_INTEGER;
        return ordenA - ordenB;
      });

    lista.replaceChildren();
    if (preguntas.length === 0) {
      const mensaje = document.createElement("p");
      mensaje.className = "faq-empty";
      mensaje.textContent = "Pronto tendremos respuestas para tus dudas.";
      lista.appendChild(mensaje);
      return;
    }

    preguntas.forEach((item) => {
      const detalle = document.createElement("details");
      const titulo = document.createElement("summary");
      const respuesta = document.createElement("p");
      titulo.textContent = item.pregunta;
      respuesta.textContent = item.respuesta;
      detalle.append(titulo, respuesta);
      lista.appendChild(detalle);
    });
  } catch (error) {
    console.error("Error cargando preguntas frecuentes", error);
    lista.replaceChildren();
    const mensaje = document.createElement("p");
    mensaje.className = "faq-empty";
    mensaje.textContent = "No pudimos cargar las preguntas frecuentes por ahora.";
    lista.appendChild(mensaje);
  }
}

function cambiarVista(nextPage, options = {}) {
  const destino = ["inicio", "unitarios", "packs"].includes(nextPage) ? nextPage : "inicio";
  const currentView = document.querySelector(".app-view.active");
  const nextView = document.querySelector(`[data-view="${destino === "inicio" ? "inicio" : "catalogo"}"]`);

  if (!nextView) return;
  if (destino === page && currentView === nextView && !options.force) return;

  page = destino;
  document.body.dataset.page = destino;
  actualizarNav(destino);

  document.querySelectorAll(".app-view").forEach((view) => {
    view.classList.remove("active", "entering", "leaving");
  });

  if (currentView && currentView !== nextView) {
    currentView.classList.add("leaving");
  }
  mostrarVista(nextView, destino);

  if (!options.replaceHash) {
    history.pushState({ page: destino }, "", `#${destino}`);
  }
}

function mostrarVista(view, destino) {
  view.classList.add("active", "entering");
  window.setTimeout(() => view.classList.remove("entering"), 260);
  window.scrollTo({ top: 0, behavior: "auto" });
  mostrarBarraNavegacion();
  cerrarFiltrosFlotantes();

  if (destino === "packs" || destino === "unitarios") {
    prepararCatalogo(destino);
  }
}

function mostrarBarraNavegacion() {
  document.querySelector(".bottom-nav")?.classList.remove("nav-hidden");
  ultimoScroll = obtenerScrollVertical();
}

function obtenerScrollVertical() {
  return Math.max(
    window.scrollY || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0
  );
}

function actualizarBarraAlDesplazar() {
  const barra = document.querySelector(".bottom-nav");
  if (!barra) return;

  const scrollActual = obtenerScrollVertical();
  const diferencia = scrollActual - ultimoScroll;

  if (scrollActual <= 16) {
    barra.classList.remove("nav-hidden");
  } else if (Math.abs(diferencia) >= 6) {
    barra.classList.toggle("nav-hidden", diferencia > 0);
  }

  ultimoScroll = scrollActual;
  scrollPendiente = false;
}

function activarOcultarNavegacion() {
  ultimoScroll = obtenerScrollVertical();
  const manejarScroll = () => {
    if (scrollPendiente) return;

    scrollPendiente = true;
    window.requestAnimationFrame(actualizarBarraAlDesplazar);
  };

  window.addEventListener("scroll", manejarScroll, { passive: true });
  document.addEventListener("scroll", manejarScroll, { passive: true, capture: true });
}

function actualizarNav(destino) {
  document.querySelectorAll(".bottom-nav [data-view-link]").forEach((link) => {
    const active = link.dataset.viewLink === destino;
    link.classList.toggle("active", active);
    link.toggleAttribute("aria-current", active);
  });
}

function prepararCatalogo(tipo) {
  const meta = catalogMeta[tipo];
  const solicitudId = ++solicitudCatalogoActual;
  document.getElementById("catalogNote").textContent = meta.note;
  document.getElementById("catalogTitle").textContent = meta.title;
  document.getElementById("catalogCopy").textContent = meta.copy;
  actualizarAyudaCatalogo(meta);

  limpiarInputs();
  actualizarFiltroConsola(tipo);

  if (!meta.sheetId && !meta.csvUrl) {
    datosOriginales = [];
    renderEmptyState(meta.emptyTitle, meta.emptyCopy);
    return;
  }

  if (catalogCache[tipo]) {
    datosOriginales = catalogCache[tipo];
    aplicarFiltros();
    return;
  }

  cargarCatalogo(tipo, solicitudId);
}

function actualizarAyudaCatalogo(meta) {
  const panel = document.getElementById("ayudaCatalogo");
  const boton = document.getElementById("abrirAyudaCatalogo");
  const titulo = document.getElementById("ayudaCatalogoTitulo");
  const texto = document.getElementById("ayudaCatalogoTexto");

  if (titulo) titulo.textContent = meta.helpTitle;
  if (texto) texto.textContent = meta.helpCopy;
  if (panel) panel.hidden = true;
  boton?.setAttribute("aria-expanded", "false");
}

async function cargarCatalogo(tipo, solicitudId) {
  const meta = catalogMeta[tipo];

  renderEmptyState("Cargando catalogo", "Estamos trayendo la disponibilidad actualizada.");

  try {
    const data = meta.sheetId
      ? await cargarGoogleSheetJSONP(meta)
      : await cargarCSV(meta.csvUrl);

    if (solicitudId !== solicitudCatalogoActual || page !== tipo) return;

    datosOriginales = (data || []).filter((row) =>
      Object.values(row).some((value) => String(value ?? "").trim() !== "")
    );
    catalogCache[tipo] = datosOriginales;
    aplicarFiltros();
  } catch (error) {
    console.error("Error cargando catalogo", error);
    if (solicitudId !== solicitudCatalogoActual || page !== tipo) return;
    renderEmptyState("No pudimos cargar el catalogo", "Google Sheets no respondio. Intenta nuevamente o escribenos por WhatsApp.");
  }
}

function cargarGoogleSheetJSONP({ sheetId, gid }) {
  return new Promise((resolve, reject) => {
    const callbackName = `__heyDigiSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo agotado cargando Google Sheets."));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      try {
        if (!response || response.status !== "ok") {
          throw new Error(response?.errors?.[0]?.detailed_message || "Respuesta invalida de Google Sheets.");
        }
        resolve(gvizTableToRows(response.table));
      } catch (error) {
        reject(error);
      } finally {
        cleanup();
      }
    };

    const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
    url.searchParams.set("tqx", `responseHandler:${callbackName}`);
    url.searchParams.set("gid", gid);
    url.searchParams.set("headers", "1");

    script.src = url.toString();
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo conectar a Google Sheets."));
    };
    document.head.appendChild(script);
  });
}

async function cargarCSV(csvUrl) {
  if (!csvUrl) return [];
  const response = await fetch(csvUrl);
  if (!response.ok) throw new Error(`CSV respondio ${response.status}`);
  const text = await response.text();
  return parseCSV(text);
}

function gvizTableToRows(table) {
  const headers = (table?.cols || []).map((col, index) =>
    String(col.label || col.id || `Columna ${index + 1}`).trim()
  );

  return (table?.rows || []).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      const cell = row.c?.[index];
      item[header] = cell?.f ?? cell?.v ?? "";
    });
    return item;
  });
}

function parseCSV(text) {
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  rows.push(row);

  const headers = rows.shift()?.map((header) => header.trim()) || [];
  return rows.map((values) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index] ?? "";
    });
    return item;
  });
}

function renderCatalogo(rows) {
  resultadosCatalogo = rows
    .map((row) => normalizarItem(row))
    .filter((item) => Number.isFinite(parseCLP(item.precio)) && (item.esUnitario || String(item.consola).trim() !== ""))
    .sort((a, b) => a.esUnitario
      ? String(a.juegos).localeCompare(String(b.juegos), "es", { sensitivity: "base" })
      : 0);
  cantidadVisibleCatalogo = Math.min(RESULTADOS_POR_CARGA, resultadosCatalogo.length);
  renderResultadosCatalogo();
}

function renderResultadosCatalogo() {
  const catalogo = document.getElementById("catalogo");
  if (!catalogo) return;
  catalogo.replaceChildren();

  if (resultadosCatalogo.length === 0) {
    const meta = catalogMeta[page] || catalogMeta.packs;
    renderEmptyState(meta.emptyTitle, meta.emptyCopy);
    return;
  }

  pintarCards(resultadosCatalogo.slice(0, cantidadVisibleCatalogo), catalogo);
  animarEntradas(catalogo.querySelectorAll(".pack"));

  const restantes = resultadosCatalogo.length - cantidadVisibleCatalogo;
  if (restantes > 0) {
    const cargarMas = document.createElement("article");
    cargarMas.className = "load-more-state";
    cargarMas.innerHTML = `
      <p>${restantes} ${page === "packs" ? "packs" : "juegos"} más disponibles</p>
      <button class="btn-secondary load-more-button" type="button">Mostrar más</button>
    `;
    cargarMas.querySelector("button")?.addEventListener("click", () => {
      cantidadVisibleCatalogo = Math.min(cantidadVisibleCatalogo + RESULTADOS_POR_CARGA, resultadosCatalogo.length);
      renderResultadosCatalogo();
    });
    catalogo.appendChild(cargarMas);
  }
}

function pintarCards(items, catalogo) {
  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const precio = parseCLP(item.precio);
    const card = document.createElement("article");
    card.className = `pack${item.esUnitario ? " unitario-card" : ""}`;
    const titulo = item.esUnitario ? item.juegos : `Pack N°${item.id}`;

    const imagen = item.esUnitario && /^https?:\/\//i.test(String(item.imagen))
      ? `<img class="unitario-imagen" src="${escapeHTML(item.imagen)}" alt="Portada de ${escapeHTML(item.juegos)}" loading="lazy" decoding="async">`
      : "";
    const espacio = item.esUnitario && item.espacio
      ? `<span class="espacio-juego">${escapeHTML(item.espacio)}</span>`
      : "";
    const detalle = item.esUnitario
      ? `<p class="unitario-meta">${espacio}</p>`
      : `<p><strong>Juegos incluidos</strong></p><ul>${juegosAHTML(item.juegos, Infinity)}</ul>`;
    const compatibilidad = item.esUnitario
      ? ""
      : `<div class="compatibilidad">
          <h4>Compatibilidad</h4>
          ${consolasAHTML(item.consola)}
        </div>`;

    card.innerHTML = `
      ${imagen}
      <div class="card-heading">
        <h2>${escapeHTML(titulo)}</h2>
      </div>
      ${detalle}
      ${compatibilidad}

      <div class="seccion-precio-boton">
        <div class="info-precio">
          <h4>Precio</h4>
          <p class="precio">$${precio.toLocaleString("es-CL")} <span class="clp-flag">CLP</span></p>
        </div>
        <a href="${crearLinkWhatsApp(item)}" class="btn-wsp" target="_blank" rel="noopener">
          <img src="assets/icons/whatsapp.svg" alt="" class="wsp-icon">
          Comprar
        </a>
      </div>
    `;

    fragment.appendChild(card);
  }

  catalogo.appendChild(fragment);
}

function renderEmptyState(titulo, texto) {
  const catalogo = document.getElementById("catalogo");
  if (!catalogo) return;
  catalogo.innerHTML = `
    <article class="empty-state">
      <h2>${escapeHTML(titulo)}</h2>
      <p>${escapeHTML(texto)}</p>
      <a class="btn-primary" href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
    </article>
  `;
}

function crearLinkWhatsApp(item) {
  const precio = parseCLP(item.precio);
  const nombre = page === "packs" ? `Pack N°${item.id}` : item.juegos;
  const mensaje =
    `Hola! Me interesa el ${nombre} que vi en la pagina de HeyDigi.\n\n` +
    `Juegos:\n${item.juegos}\n\n` +
    `Precio: $${precio.toLocaleString("es-CL")} CLP`;

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
}

function aplicarFiltros({ notificar = false } = {}) {
  const nombre = normalizarBusqueda(document.getElementById("filtroNombre")?.value);
  const consola = document.getElementById("filtroConsola")?.value.toLowerCase().trim() || "";
  const precioMinimo = parseCLP(document.getElementById("filtroPrecioMinimo")?.value);
  const precioMaximo = parseCLP(document.getElementById("filtroPrecioMaximo")?.value);
  const palabras = nombre.split(/\s+/).filter(Boolean);

  const filtrados = datosOriginales.filter((row) => {
    const item = normalizarItem(row);
    const textoJuegos = normalizarBusqueda(item.juegos);
    const consolas = String(item.consola)
      .toLowerCase()
      .split(",")
      .map((valor) => valor.trim())
      .filter(Boolean);
    const textoId = normalizarBusqueda(item.id);
    const precio = parseCLP(item.precio);

    const coincideNombre = palabras.every((palabra) =>
      coincideBusqueda(textoJuegos, palabra) || coincideBusqueda(textoId, palabra)
    );
    const tieneSwitch = consolas.includes("nintendo switch");
    const tieneSwitch2 = consolas.includes("nintendo switch 2");
    // "Ambas" es la vista predeterminada: muestra todo el catálogo,
    // incluidos los packs exclusivos de Switch 2.
    const coincideConsola = !consola || consola === "ambas" || (
      consola === "nintendo switch 2" && tieneSwitch2 && !tieneSwitch
    );
    const cumpleMinimo = !Number.isFinite(precioMinimo) || precio >= precioMinimo;
    const cumpleMaximo = !Number.isFinite(precioMaximo) || precio <= precioMaximo;

    return coincideNombre && coincideConsola && cumpleMinimo && cumpleMaximo;
  });

  actualizarFiltrosActivos();
  renderCatalogo(filtrados);
  if (notificar) showToast(filtrados.length, filtrados.length > 0 ? "ok" : "error");
}

function limpiarFiltros() {
  limpiarInputs();
  actualizarFiltroConsola(page);
  aplicarFiltros();
}

function limpiarInputs() {
  const inputNombre = document.getElementById("filtroNombre");
  const inputPrecioMinimo = document.getElementById("filtroPrecioMinimo");
  const inputPrecioMaximo = document.getElementById("filtroPrecioMaximo");
  const selectConsola = document.getElementById("filtroConsola");

  if (inputNombre) inputNombre.value = "";
  if (inputPrecioMinimo) inputPrecioMinimo.value = "";
  if (inputPrecioMaximo) inputPrecioMaximo.value = "";
  if (selectConsola) selectConsola.value = "";
  actualizarFiltrosActivos();
}

function actualizarFiltroConsola(tipo) {
  const grupo = document.getElementById("grupoFiltroConsola");
  const select = document.getElementById("filtroConsola");
  if (grupo) grupo.hidden = tipo !== "packs";
  if (select) select.value = tipo === "packs" ? "Ambas" : "";
  actualizarBotonesConsola(select?.value);
}

function actualizarBotonesConsola(valor) {
  document.querySelectorAll("[data-console-filter]").forEach((boton) => {
    const activo = boton.dataset.consoleFilter === valor;
    boton.classList.toggle("active", activo);
    boton.setAttribute("aria-pressed", String(activo));
  });
}

function actualizarFiltrosActivos() {
  const contenedor = document.getElementById("filtrosActivos");
  const fila = document.getElementById("filaFiltrosActivos");
  if (!contenedor) return;

  const nombre = document.getElementById("filtroNombre")?.value.trim();
  const consola = document.getElementById("filtroConsola")?.value.trim();
  const precioMinimo = parseCLP(document.getElementById("filtroPrecioMinimo")?.value);
  const precioMaximo = parseCLP(document.getElementById("filtroPrecioMaximo")?.value);
  const filtros = [];

  if (nombre) filtros.push(`Buscar: ${nombre}`);
  if (consola && consola !== "Ambas") filtros.push(`Consola: ${consola}`);
  if (Number.isFinite(precioMinimo)) filtros.push(`Desde: $${precioMinimo.toLocaleString("es-CL")} CLP`);
  if (Number.isFinite(precioMaximo)) filtros.push(`Hasta: $${precioMaximo.toLocaleString("es-CL")} CLP`);

  contenedor.replaceChildren(...filtros.map((filtro) => {
    const chip = document.createElement("span");
    chip.className = "filter-chip";
    chip.textContent = filtro;
    return chip;
  }));
  if (fila) fila.hidden = filtros.length === 0;
}

function abrirFiltrosFlotantes() {
  const panel = document.getElementById("panelFiltros");
  const shell = document.querySelector(".filter-shell");
  const backdrop = document.getElementById("filtrosBackdrop");
  const toggle = document.getElementById("toggleFiltros");

  if (!panel || !shell || !toggle) return;
  window.clearTimeout(shell._closeTimer);
  shell.classList.remove("filters-modal-closing");
  backdrop?.classList.remove("is-closing");
  shell.classList.add("filters-modal-open");
  panel.hidden = false;
  if (backdrop) backdrop.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
}

function cerrarFiltrosFlotantes() {
  const panel = document.getElementById("panelFiltros");
  const shell = document.querySelector(".filter-shell");
  const backdrop = document.getElementById("filtrosBackdrop");
  const toggle = document.getElementById("toggleFiltros");

  if (!shell?.classList.contains("filters-modal-open")) return;

  shell.classList.add("filters-modal-closing");
  backdrop?.classList.add("is-closing");
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
  }

  window.clearTimeout(shell._closeTimer);
  shell._closeTimer = window.setTimeout(() => {
    shell.classList.remove("filters-modal-open", "filters-modal-closing");
    if (panel) panel.hidden = true;
    if (backdrop) {
      backdrop.hidden = true;
      backdrop.classList.remove("is-closing");
    }
  }, 200);
}

function activarFiltrosAutomaticos() {
  const inputNombre = document.getElementById("filtroNombre");
  const inputPrecioMinimo = document.getElementById("filtroPrecioMinimo");
  const inputPrecioMaximo = document.getElementById("filtroPrecioMaximo");
  const selectConsola = document.getElementById("filtroConsola");
  const toggle = document.getElementById("toggleFiltros");

  const aplicarConRetraso = () => {
    window.clearTimeout(inputNombre?._filterTimer);
    window.clearTimeout(inputPrecioMinimo?._filterTimer);
    window.clearTimeout(inputPrecioMaximo?._filterTimer);
    const timer = window.setTimeout(() => aplicarFiltros(), 120);
    if (document.activeElement === inputNombre && inputNombre) inputNombre._filterTimer = timer;
    if (document.activeElement === inputPrecioMinimo && inputPrecioMinimo) inputPrecioMinimo._filterTimer = timer;
    if (document.activeElement === inputPrecioMaximo && inputPrecioMaximo) inputPrecioMaximo._filterTimer = timer;
  };

  inputNombre?.addEventListener("input", aplicarConRetraso);
  [inputPrecioMinimo, inputPrecioMaximo].forEach((input) => {
    input?.addEventListener("input", () => {
      const digits = input.value.replace(/[^\d]/g, "");
      input.value = digits ? Number(digits).toLocaleString("es-CL") : "";
      aplicarConRetraso();
    });
  });
  selectConsola?.addEventListener("change", aplicarFiltros);
  document.querySelectorAll("[data-console-filter]").forEach((boton) => {
    boton.addEventListener("click", () => {
      if (!selectConsola) return;
      selectConsola.value = boton.dataset.consoleFilter;
      actualizarBotonesConsola(selectConsola.value);
      aplicarFiltros();
    });
  });

  toggle?.addEventListener("click", () => {
    const abierto = toggle.getAttribute("aria-expanded") === "true";
    if (abierto) cerrarFiltrosFlotantes();
    else abrirFiltrosFlotantes();
  });

  document.getElementById("filtrosBackdrop")?.addEventListener("click", cerrarFiltrosFlotantes);
  document.getElementById("cerrarFiltros")?.addEventListener("click", cerrarFiltrosFlotantes);
  document.getElementById("limpiarFiltrosRapido")?.addEventListener("click", limpiarFiltros);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cerrarFiltrosFlotantes();
  });
}

function activarNintendoOnline() {
  const tipo = document.getElementById("onlineTipo");
  const precio = document.getElementById("onlinePrecio");
  const comprar = document.getElementById("comprarOnline");
  const visual = document.getElementById("onlineVisual");
  const visualContainer = document.getElementById("onlineVisualContainer");
  const modos = [...document.querySelectorAll("[data-online-plan]")];
  const duraciones = [...document.querySelectorAll("[data-online-duration]")];
  const grupoModos = modos[0]?.parentElement;
  const grupoDuraciones = duraciones[0]?.parentElement;
  let planActual = "online";
  let duracionActual = "3";

  const actualizar = (animarPrecio = false) => {
    const plan = ONLINE_PLANS[planActual];
    const valor = plan.precios[duracionActual];
    if (tipo) {
      tipo.classList.remove("is-changing");
      tipo.innerHTML = `<span class="online-tag-text">${plan.nombre}</span>`;

      if (animarPrecio) {
        void tipo.offsetWidth;
        tipo.classList.add("is-changing");
        clearTimeout(tipo._animationTimer);
        tipo._animationTimer = setTimeout(() => tipo.classList.remove("is-changing"), 360);
      }
    }
    if (grupoModos) grupoModos.dataset.selected = planActual;
    if (grupoDuraciones) grupoDuraciones.dataset.selected = duracionActual;
    if (visual) {
      if (animarPrecio) visualContainer?.classList.remove("is-changing");
      visual.src = plan.imagen;
      visual.alt = `Nintendo Switch ${plan.nombre}`;

      if (animarPrecio && visualContainer) {
        void visual.offsetWidth;
        visualContainer.classList.add("is-changing");
        clearTimeout(visualContainer._animationTimer);
        visualContainer._animationTimer = setTimeout(() => visualContainer.classList.remove("is-changing"), 420);
      }
    }
    if (precio) {
      precio.classList.remove("is-changing");
      precio.innerHTML = `<span class="online-price-value">$${valor.toLocaleString("es-CL")}</span> <span class="online-price-currency">CLP</span>`;

      if (animarPrecio) {
        void precio.offsetWidth;
        precio.classList.add("is-changing");
        clearTimeout(precio._animationTimer);
        precio._animationTimer = setTimeout(() => precio.classList.remove("is-changing"), 460);
      }
    }
    if (comprar) {
      const mensaje = `Hola! Me interesa Nintendo Switch ${plan.nombre} por ${duracionActual} meses ($${valor.toLocaleString("es-CL")} CLP).`;
      comprar.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
    }
  };

  modos.forEach((boton) => boton.addEventListener("click", () => {
    planActual = boton.dataset.onlinePlan;
    modos.forEach((item) => {
      const activo = item === boton;
      item.classList.toggle("active", activo);
      item.setAttribute("aria-selected", String(activo));
    });
    actualizar(true);
  }));

  duraciones.forEach((boton) => boton.addEventListener("click", () => {
    duracionActual = boton.dataset.onlineDuration;
    duraciones.forEach((item) => item.classList.toggle("active", item === boton));
    actualizar(true);
  }));

  actualizar();
}

function showToast(count, type = "ok") {
  const toast = document.getElementById("mensajeFiltro");
  if (!toast) return;

  toast.classList.toggle("error", type === "error");
  toast.textContent = type === "error"
    ? "No se encontraron coincidencias"
    : `Se encontraron ${count} coincidencias`;

  requestAnimationFrame(() => toast.classList.add("visible"));
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function activarNavegacionInterna() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-view-link]");
    if (!link) return;

    const destino = link.dataset.viewLink;
    if (!destino) return;

    event.preventDefault();
    cambiarVista(destino);
  });
}

function activarDesplazamientosInternos() {
  document.addEventListener("click", (event) => {
    const enlace = event.target.closest("[data-scroll-to]");
    if (!enlace) return;

    const destino = document.getElementById(enlace.dataset.scrollTo);
    if (!destino) return;

    event.preventDefault();
    destino.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function activarAyudaCatalogo() {
  const boton = document.getElementById("abrirAyudaCatalogo");
  const panel = document.getElementById("ayudaCatalogo");
  if (!boton || !panel) return;

  boton.addEventListener("click", (event) => {
    event.stopPropagation();
    const abierto = !panel.hidden;
    panel.hidden = abierto;
    boton.setAttribute("aria-expanded", String(!abierto));
  });

  document.addEventListener("click", (event) => {
    if (panel.hidden || event.target.closest(".catalog-hero")) return;
    panel.hidden = true;
    boton.setAttribute("aria-expanded", "false");
  });
}

function activarTerminos() {
  const trigger = document.getElementById("abrirTerminos");
  const modal = document.getElementById("modalTerminos");
  const backdrop = document.getElementById("fondoTerminos");
  const closeButton = document.getElementById("cerrarTerminos");
  const acceptButton = document.getElementById("aceptarTerminos");

  if (!trigger || !modal || !backdrop) return;

  const abrir = () => {
    clearTimeout(modal.closeTimer);
    modal.hidden = false;
    backdrop.hidden = false;
    trigger.setAttribute("aria-expanded", "true");

    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      backdrop.classList.add("is-open");
    });

    closeButton?.focus({ preventScroll: true });
  };

  const cerrar = () => {
    if (modal.hidden) return;

    modal.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    clearTimeout(modal.closeTimer);
    modal.closeTimer = setTimeout(() => {
      modal.hidden = true;
      backdrop.hidden = true;
      trigger.focus({ preventScroll: true });
    }, 230);
  };

  trigger.addEventListener("click", abrir);
  closeButton?.addEventListener("click", cerrar);
  acceptButton?.addEventListener("click", cerrar);
  backdrop.addEventListener("click", cerrar);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cerrar();
  });
}

function animarEntradas(elementos) {
  if (!observadorDeEntradas) return;

  [...elementos].forEach((elemento, indice) => {
    if (elemento.dataset.revealReady) return;
    elemento.dataset.revealReady = "true";
    elemento.classList.add("reveal-on-scroll");
    elemento.style.setProperty("--reveal-delay", `${Math.min(indice, 5) * 55}ms`);
    observadorDeEntradas.observe(elemento);
  });
}

function activarAnimacionesDeEntrada() {
  if (!window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  observadorDeEntradas = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add("is-visible");
      observadorDeEntradas.unobserve(entrada.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -20px" });

  animarEntradas(document.querySelectorAll(
    ".home-summary-card, .help-banner, .instagram-banner, .home-trust, .home-section, .online-section, .faq-card, .terms-section, .contact-card, .catalog-hero, .filter-shell"
  ));
}

function iniciarApp() {
  activarFiltrosAutomaticos();

  const initial = (window.location.hash || "#inicio").replace("#", "");
  cambiarVista(initial, { replaceHash: true, force: true });
  cargarOfertasInicio();
  cargarPreguntasFrecuentes();
  history.replaceState({ page }, "", `#${page}`);
}

window.addEventListener("popstate", () => {
  const next = (window.location.hash || "#inicio").replace("#", "");
  cambiarVista(next, { replaceHash: true, force: true });
});

window.addEventListener("hashchange", () => {
  const next = (window.location.hash || "#inicio").replace("#", "");
  cambiarVista(next, { replaceHash: true, force: true });
});

document.addEventListener("DOMContentLoaded", () => {
  activarAnimacionesDeEntrada();
  activarNavegacionInterna();
  activarDesplazamientosInternos();
  activarAyudaCatalogo();
  activarTerminos();
  activarOcultarNavegacion();
  activarNintendoOnline();
  iniciarApp();
});
