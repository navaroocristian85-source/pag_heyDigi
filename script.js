const catalogo = document.getElementById("catalogo");
let datosOriginales = [];

// Mostrar packs
function mostrarPacks(packs) {
  catalogo.innerHTML = "";
  packs.forEach(pack => {
    if ((pack["estado"] || "").trim().toLowerCase() !== "disponible") return;

    const div = document.createElement("div");
    div.className = "pack";

    const consolas = pack["consola"]
      ? pack["consola"].split('\n').map(c => `<span class="badge-console">${c.trim()}</span>`).join(' ')
      : '<span class="badge-console">No especificada</span>';

    const packData = encodeURIComponent(JSON.stringify(pack));

    div.innerHTML = `
      <h2>Pack N°${pack["pack ID"]}</h2>
      <p><strong>Juegos incluidos:</strong></p>
      <ul>
        ${(pack["juegos incluidos"] ?? "")
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
          <p class="precio">$${Number(pack["precio"]).toLocaleString("es-CL")} CLP</p>
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

// Cargar datos
Papa.parse(
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRFDTOUDh0yCwUYO2LN4IzFbMFudjZG-CnogJDGQvhQfDpL3C1s6Y3iLJ78ra4S-iDZjPLPjP44mcB4/pub?output=csv",
  {
    download: true,
    header: true,
    complete: function (results) {
      datosOriginales = results.data;
      mostrarPacks(datosOriginales);
    }
  }
);

// Controlar apertura y cierre de buscador
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
      const nombreIncluye = pack["juegos incluidos"]?.toLowerCase().includes(nombre);
      const consolaIncluye = consola === "" || pack["consola"]?.toLowerCase().includes(consola);
      const precioValido = isNaN(precio) || Number(pack["precio"]) <= precio;
      const disponible = (pack["estado"] || "").toLowerCase() === "disponible";
      return nombreIncluye && consolaIncluye && precioValido && disponible;
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

// Comprar por WhatsApp
document.addEventListener("click", function (e) {
  const btn = e.target.closest(".btn-wsp");
  if (!btn) return;

  e.preventDefault();

  const pack = JSON.parse(decodeURIComponent(btn.getAttribute("data-pack")));
  const mensaje = `Hola! 👋 Me interesa el Pack N°${pack["pack ID"]} que vi en la página.\n\nJuegos incluidos:\n${pack["juegos incluidos"]}\n\nPrecio: $${Number(pack["precio"]).toLocaleString("es-CL")} CLP`;

  const numeroWsp = "56941347576"; // Cambia esto si es necesario
  const link = `https://wa.me/${numeroWsp}?text=${encodeURIComponent(mensaje)}`;
  window.open(link, "_blank");
});