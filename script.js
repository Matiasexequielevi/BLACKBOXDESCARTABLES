// ---------------- CONFIGURACIÓN INICIAL ----------------
let productosProcesados = [];
let presupuesto = [];

document.getElementById("porcentaje").addEventListener("input", (e) => {
  document.getElementById("porcentajeLabel").textContent = e.target.value + "%";
});

// ---------------- PROCESAMIENTO DE ARCHIVOS ----------------
async function processFile() {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Selecciona un archivo");

  const margin = parseInt(document.getElementById("porcentaje").value);
  const tbody = document.querySelector("#priceTable tbody");
  tbody.innerHTML = '';
  productosProcesados = [];

  const ext = file.name.split('.').pop().toLowerCase();
  if (['csv', 'xlsx', 'xls'].includes(ext)) {
    await processExcelOrCSV(file, margin);
  } else if (ext === 'pdf') {
    await processPDF(file, margin);
  } else {
    alert("Formato no soportado todavía.");
  }

  actualizarSelectorPresupuesto();
}

async function processExcelOrCSV(file, margin) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  rows.forEach(row => {
    if (row.length >= 2) {
      const producto = row[0];
      const precio = parseFloat(row[1]);
      if (!isNaN(precio)) addRow(producto, precio, margin);
    }
  });
}

async function processPDF(file, margin) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items.map(item => item.str).join(' ').split('$');

    lines.forEach((line, index) => {
      if (index === 0) return;
      const parts = line.trim().split(/\s+/);
      const priceStr = parts.shift();
      const price = parseFloat(priceStr.replace('.', '').replace(',', '.'));

      if (!isNaN(price)) {
        const producto = parts.join(' ').trim();
        addRow(producto, price, margin);
      }
    });
  }
}

// ---------------- GESTIÓN DE TABLA PRINCIPAL ----------------
function addRow(producto, precio, margin) {
  const finalPrice = precio + (precio * margin / 100);
  const tbody = document.querySelector("#priceTable tbody");

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${producto}</td>
    <td>$${finalPrice.toFixed(2)}</td>
  `;
  tbody.appendChild(tr);

  productosProcesados.push({ producto, finalPrice });
}

// ---------------- EXPORTAR EXCEL ----------------
function exportExcel() {
  const rows = [["Producto", "Precio Final"]];
  document.querySelectorAll("#priceTable tbody tr").forEach(tr => {
    const cells = tr.querySelectorAll("td");
    rows.push(Array.from(cells).map(td => td.textContent));
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Lista de Precios");
  XLSX.writeFile(wb, "lista_blackbox.xlsx");
}

// ---------------- GENERAR ENCABEZADO PDF ----------------
function generarEncabezadoPDF(doc) {
  const logo = new Image();
  logo.src = "logo.png";

  // Logo centrado
  doc.addImage(logo, "PNG", 30, 10, 150, 60);
  // Datos de empresa centrados
  doc.setFontSize(14).setFont(undefined, "bold").setTextColor(0, 0, 0);
  doc.text("BLACK BOX DESCARTABLES", 105, 50, { align: "center" });
  doc.setFontSize(10).setFont(undefined, "normal");
  doc.text("LOS MEJORES PRECIOS PARA TU NEGOCIO", 105, 56, { align: "center" });
  doc.text("Av. Colón 3233 - Alto Alberdi - Córdoba", 105, 62, { align: "center" });
  doc.text("WhatsApp: 351 808 1076 - Alias: BLACKBOX.17.MP", 105, 68, { align: "center" });
  doc.text("Envíos a Domicilio", 105, 74, { align: "center" });
}

// ---------------- SISTEMA DE PRESUPUESTOS ----------------
function actualizarSelectorPresupuesto() {
  const select = document.getElementById("productoPresupuesto");
  select.innerHTML = "";
  productosProcesados.forEach((p, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `${p.producto} - $${p.finalPrice.toFixed(2)}`;
    select.appendChild(option);
  });
}

function agregarPresupuesto() {
  const index = document.getElementById("productoPresupuesto").value;
  const cantidad = parseInt(document.getElementById("cantidadPresupuesto").value);
  if (index === "" || isNaN(cantidad) || cantidad <= 0) return;

  const prod = productosProcesados[index];
  const total = prod.finalPrice * cantidad;

  presupuesto.push({ ...prod, cantidad, total });
  renderPresupuesto();
}

function renderPresupuesto() {
  const tbody = document.querySelector("#presupuestoTable tbody");
  tbody.innerHTML = "";

  presupuesto.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.producto}</td>
      <td>${item.cantidad}</td>
      <td>$${item.finalPrice.toFixed(2)}</td>
      <td>$${item.total.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------- EXPORTAR PRESUPUESTO PDF ----------------
function exportarPresupuestoPDF() {
  if (presupuesto.length === 0) return alert("No hay productos en el presupuesto.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');

  generarEncabezadoPDF(doc);

  const nombreCliente = document.getElementById("nombreCliente").value || "Cliente";
  const fecha = new Date().toLocaleDateString("es-AR");
  const validezDias = document.getElementById("validez").value || 7;

  // Datos del cliente
  doc.setFontSize(12).setTextColor(0, 0, 0);
  doc.text(`Cliente: ${nombreCliente}`, 15, 90);
  doc.text(`Fecha: ${fecha}`, 200, 90, { align: "right" });

  // Tabla de productos
  const rows = presupuesto.map(item => [
    item.producto,
    item.cantidad,
    "$" + item.finalPrice.toFixed(2),
    "$" + item.total.toFixed(2)
  ]);

  doc.autoTable({
    startY: 100,
    head: [["Producto", "Cant.", "Precio Unit.", "Total"]],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [0, 200, 83], textColor: 255, halign: "center" },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    styles: { fontSize: 10, halign: 'center' }
  });

  // Total y nota
  const totalGeneral = presupuesto.reduce((sum, p) => sum + p.total, 0);
  const totalFormateado = totalGeneral.toLocaleString("es-AR", { minimumFractionDigits: 2 });
  const finalY = doc.lastAutoTable.finalY + 15;

  doc.setFillColor(240, 255, 240);
  doc.rect(10, finalY - 8, 190, 15, "F");
  doc.setFontSize(16).setTextColor(0, 200, 83);
  doc.text(`TOTAL PRESUPUESTO: $${totalFormateado}`, 15, finalY + 2);

  doc.setFontSize(10).setTextColor(0, 0, 0);
  doc.text(
    "PRECIOS ABONANDO EN EFECTIVO/TRANSFERENCIA (TARJ. CREDITO Y DEBITO CON RECARGO)",
    15,
    finalY + 12
  );
  doc.setFontSize(11);
  doc.text(`Presupuesto válido por ${validezDias} días`, 15, finalY + 18);

  doc.save("presupuesto_blackbox.pdf");
}

// ---------------- HACER VISIBLE PARA EL HTML ----------------
window.processFile = processFile;
window.exportExcel = exportExcel;
window.agregarPresupuesto = agregarPresupuesto;
window.exportarPresupuestoPDF = exportarPresupuestoPDF;
window.processPDF = processPDF; // <- NECESARIO para que el HTML la encuentre
