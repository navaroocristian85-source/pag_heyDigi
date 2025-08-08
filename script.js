const catalogo = document.getElementById("catalogo");
let datosOriginales = [];

function mostrarPacks(packs) {
  catalogo.innerHTML = "";
  packs.forEach(pack => {
    const tienePrecio = !isNaN(Number(pack["Precio CLP"]));
    const tieneConsola = (pack["Consola"] || "").trim() !== "";

    if (!tienePrecio || !tieneConsola) return;

    const div = document.createElement("div");
    div.className = "pack";

    const consolas = pack["Consola"]
      ? pack["Consola"].split(',').map(c => `<span class="badge-console">${c.trim()}</span>`).join(' ')
      : '<span class="badge-console">No especificada</span>';

    const packData = encodeURIComponent(JSON.stringify(pack));

    div.innerHTML = `
      <h2>Pack N°${pack["Pack ID"]}</h2>
      <p><strong>Juegos incluidos:</strong></p>
      <ul>
        ${(pack["Juegos Incluidos"] ?? "")
          .split('\n')
          .map(j => `<li>${j.trim()}</li>`)
          .join("")}
      </ul>
      <div class="compatibilidad">
        <h4>Compatibilidad</h4>
        ${consolas}
      </div>
      <div class="seccion-precio-boton">
        <div class="info-precio">
          <h4>Precio</h4>
          <p class="precio">$${Number(pack["Precio CLP"]).toLocaleString("es-CL")} CLP</p>
        </div>
        <a href="#" class="btn-wsp" data-pack='${packData}'>
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" class="wsp-icon">
          Comprar
        </a>
      </div>
    `;
    catalogo.appendChild(div);
  });
}

Papa.parse(
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRFDTOUDh0yCwUYO2LN4IzFbMFudjZG-CnogJDGQvhQfDpL3C1s6Y3iLJ78ra4S-iDZjPLPjP44mcB4/pub?gid=1135075618&single=true&output=csv",
  {
    download: true,
    header: true,
    complete: function (results) {
      datosOriginales = results.data;
      mostrarPacks(datosOriginales);
      cargarOpcionesConsola(); // ← Agregado para autocompletar el filtro
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

document.addEventListener("DOMContentLoaded", () => {
  const lupa = document.getElementById("searchIcon");
  const dropdown = document.getElementById("buscadorDropdown");
  const barra = document.getElementById("barraFlotante");
  const aplicarBtn = document.getElementById("aplicarFiltros");
  const limpiarBtn = document.getElementById("limpiarFiltros");

  document.addEventListener("click", (e) => {
    const esLupa = lupa.contains(e.target);
    const esDentroNavbar = barra.contains(e.target);

    if (esLupa) {
      barra.classList.toggle("expandido");
    } else if (!esDentroNavbar) {
      barra.classList.remove("expandido");
    }
  });

  aplicarBtn.addEventListener("click", () => {
    const nombre = document.getElementById("filtroNombre").value.toLowerCase();
    const consola = document.getElementById("filtroConsola").value.toLowerCase();
    const precio = parseInt(document.getElementById("filtroPrecio").value);

    const filtrados = datosOriginales.filter(pack => {
      const juegos = (pack["Juegos Incluidos"] || "").toLowerCase();
      const consolaTexto = (pack["Consola"] || "").toLowerCase();
      const tienePrecio = !isNaN(Number(pack["Precio CLP"]));
      const tieneConsola = consolaTexto.trim() !== "";
      const precioValido = isNaN(precio) || Number(pack["Precio CLP"]) <= precio;

      const palabrasClave = nombre.split(" ").filter(p => p.trim() !== "");
      const nombreIncluye = palabrasClave.every(palabra =>
      juegos.includes(palabra) || pack["Pack ID"]?.toString() === palabra
    );

      const consolaIncluye = consola === "" || consolaTexto.includes(consola);

      return nombreIncluye && consolaIncluye && precioValido && tieneConsola && tienePrecio;
    });

    mostrarPacks(filtrados);
    barra.classList.remove("expandido");
  });

  limpiarBtn.addEventListener("click", () => {
    document.getElementById("filtroNombre").value = "";
    document.getElementById("filtroConsola").value = "";
    document.getElementById("filtroPrecio").value = "";
    mostrarPacks(datosOriginales);
  });
});

document.addEventListener("click", function (e) {
  const btn = e.target.closest(".btn-wsp");
  if (!btn) return;

  e.preventDefault();

  const pack = JSON.parse(decodeURIComponent(btn.getAttribute("data-pack")));
  const mensaje = `Hola! 👋 Me interesa el Pack N°${pack["Pack ID"]} que vi en la página.\n\nJuegos incluidos:\n${pack["Juegos Incluidos"]}\n\nPrecio: $${Number(pack["Precio CLP"]).toLocaleString("es-CL")} CLP`;

  const numeroWsp = "56941347576";
  const link = `https://wa.me/${numeroWsp}?text=${encodeURIComponent(mensaje)}`;
  window.open(link, "_blank");
});