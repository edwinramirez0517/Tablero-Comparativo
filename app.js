Chart.register(ChartDataLabels);

let datosVentas = [];
let datosSaldos = [];

// Diccionario cronológico para forzar el orden correcto de los meses (Punto 4)
const ordenMesesMap = { 'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12 };

// Utilidad para formatear números con comas
function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return new Intl.NumberFormat('en-US').format(Math.round(num));
}

// Lógica de PESTAÑAS (Punto 5)
function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].className = tabcontent[i].className.replace(" active", "");
    }
    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).className += " active";
    evt.currentTarget.className += " active";
    // Forzar redibujado de gráficos al cambiar de pestaña si estaban ocultos
    if(tabName === 'tab-graficos') { actualizarTablero(); }
}

// 1. Cargar Ventas
function cargarVentas() {
    return new Promise((resolver, rechazar) => {
        Papa.parse('ventas.csv', {
            download: true, header: false, delimiter: ';',
            complete: function(resultados) {
                const filas = resultados.data;
                const mesesRow = filas[0];
                const metricasRow = filas[1];
                let procesado = [];
                for(let i = 2; i < filas.length; i++) {
                    const fila = filas[i];
                    if(!fila || fila.length < 7 || !fila[0]) continue;
                    const tienda = fila[3], division = fila[4], categoria = fila[5];
                    let tipo_tienda = (tienda.includes("AEC") || tienda.includes("DS")) ? "Mayoreo" : "Detalle";
                    for(let c = 7; c < fila.length; c++) {
                        if (metricasRow[c] === 'Venta_Und_Anterior') {
                            let mes = mesesRow[c];
                            let pasado = parseFloat(fila[c]) || 0;
                            let actual = parseFloat(fila[c+1]) || 0; 
                            if (pasado !== 0 || actual !== 0) {
                                procesado.push({ mes, tipo: tipo_tienda, tienda, division, categoria, pasado, actual });
                            }
                        }
                    }
                }
                resolver(procesado);
            }, error: rechazar
        });
    });
}

// 2. Cargar Saldos
function cargarSaldos() {
    return new Promise((resolver, rechazar) => {
        Papa.parse('saldos.csv', {
            download: true, header: true, delimiter: ';', dynamicTyping: true,
            complete: function(resultados) {
                let procesado = [];
                resultados.data.forEach(fila => {
                    if(fila.Name) {
                        let saldo_actual_real = parseFloat(fila.Saldo_Total_Anterior) || 0; // Lógica invertida en origen
                        let saldo_anterior_real = parseFloat(fila.Saldo_Total_Actual) || 0; // Lógica invertida en origen
                        let tipo_tienda = (fila.Name.includes("AEC") || fila.Name.includes("DS")) ? "Mayoreo" : "Detalle";
                        procesado.push({ tienda: fila.Name, tipo: tipo_tienda, division: fila.Division, categoria: fila.Categoria, saldo_actual: saldo_actual_real, saldo_pasado: saldo_anterior_real });
                    }
                });
                resolver(procesado);
            }, error: rechazar
        });
    });
}

// 3. Inicialización
Promise.all([cargarVentas(), cargarSaldos()]).then(archivos => {
    datosVentas = archivos[0];
    datosSaldos = archivos[1];
    document.getElementById('loading').style.display = 'none';
    document.getElementById('filtros-container').style.display = 'flex';
    document.getElementById('tabs-container').style.display = 'flex';
    document.getElementById('graficos-container').style.display = 'block';
    inicializarFiltros();
    actualizarTablero();
}).catch(console.error);

// 4. Configurar Filtros Globales
function inicializarFiltros() {
    // Orden cronológico en el filtro de meses
    let mesesUnicos = [...new Set(datosVentas.map(d => d.mes))].sort((a, b) => ordenMesesMap[a] - ordenMesesMap[b]);
    llenarSelect('f-mes', mesesUnicos);
    
    llenarSelect('f-tipo', [...new Set(datosVentas.map(d => d.tipo))].sort());
    llenarSelect('f-tienda', [...new Set(datosVentas.map(d => d.tienda))].sort());
    llenarSelect('f-division', [...new Set(datosVentas.map(d => d.division))].sort());
    llenarSelect('f-categoria', [...new Set(datosVentas.map(d => d.categoria))].sort());

    ['f-mes', 'f-tipo', 'f-tienda', 'f-division', 'f-categoria'].forEach(id => {
        document.getElementById(id).addEventListener('change', actualizarTablero);
    });
}

function llenarSelect(id, opciones) {
    const select = document.getElementById(id);
    opciones.forEach(op => {
        let el = document.createElement('option');
        el.value = el.text = op;
        select.appendChild(el);
    });
}

// 5. Lógica de Filtrado y Redibujado
let graficoLinea, graficoDiv, graficoCat;

// Configuraciones comunes para limpiar gráficos visualmente
const layoutGráficosComún = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20, right: 20, bottom: 0, left: 10 } }, // Evitar cortes de etiquetas (Punto 4)
    scales: {
        x: { grid: { display: false } }, // Quitar cuadrícula
        y: { display: false, grid: { display: false } } // Quitar eje Y y cuadrícula
    },
    plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
        datalabels: {
            display: true, color: '#444', anchor: 'end', align: 'top', offset: 2,
            font: { weight: 'bold', size: 10 },
            formatter: function(value) { return formatNumber(value); }
        }
    }
};

function actualizarTablero() {
    const fMes = document.getElementById('f-mes').value;
    const fTipo = document.getElementById('f-tipo').value;
    const fTienda = document.getElementById('f-tienda').value;
    const fDiv = document.getElementById('f-division').value;
    const fCat = document.getElementById('f-categoria').value;

    // Filtro para Gráficos Comparativos y Tablas Gerenciales
    let vFiltradas = datosVentas.filter(d => {
        return (fMes === 'Todos' || d.mes === fMes) &&
               (fTipo === 'Todos' || d.tipo === fTipo) &&
               (fTienda === 'Todos' || d.tienda === fTienda) &&
               (fDiv === 'Todos' || d.division === fDiv) &&
               (fCat === 'Todos' || d.categoria === fCat);
    });

    // Filtro ESPECIAL para Tendencia Mensual (Ignora el filtro de mes para mostrar la línea de tiempo completa)
    let vTendencia = datosVentas.filter(d => {
        return (fTipo === 'Todos' || d.tipo === fTipo) &&
               (fTienda === 'Todos' || d.tienda === fTienda) &&
               (fDiv === 'Todos' || d.division === fDiv) &&
               (fCat === 'Todos' || d.categoria === fCat);
    });

    let sFiltrados = datosSaldos.filter(d => {
        return (fTipo === 'Todos' || d.tipo === fTipo) &&
               (fTienda === 'Todos' || d.tienda === fTienda) &&
               (fDiv === 'Todos' || d.division === fDiv) &&
               (fCat === 'Todos' || d.categoria === fCat);
    });

    dibujarGraficosYTablas(vFiltradas, vTendencia, sFiltrados);
}

// 6. DIBUJAR COMPONENTES
function dibujarGraficosYTablas(vData, vTendenciaData, sData) {
    
    // --- 6.1 Tendencia Mensual CORREGIDA (Punto 4: Orden Cronológico y Etiquetas) ---
    const ctxLinea = document.getElementById('chartLine').getContext('2d');
    
    // Sacamos meses únicos y los ordenamos cronológicamente
    let mesesOrdenados = [...new Set(datosVentas.map(item => item.mes))].sort((a, b) => ordenMesesMap[a] - ordenMesesMap[b]);
    
    // Sumamos act y pas ignorando el filtro de mes seleccionado
    const totActualM = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.actual, 0));
    const totPasadoM = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.pasado, 0));

    if(graficoLinea) graficoLinea.destroy();
    graficoLinea = new Chart(ctxLinea, {
        type: 'line',
        data: {
            labels: mesesOrdenados,
            datasets: [
                { label: 'Año Actual', data: totActualM, borderColor: '#012094', backgroundColor: '#012094', tension: 0.3, borderWidth: 3, pointRadius: 4 },
                { label: 'Año Pasado', data: totPasadoM, borderColor: '#E1251B', backgroundColor: '#E1251B', tension: 0.3, borderWidth: 3, pointRadius: 4 }
            ]
        }, 
        options: {
            ...layoutGráficosComún,
            plugins: {
                ...layoutGráficosComún.plugins,
                datalabels: { // Etiquetas flotando sobre los puntos
                    ...layoutGráficosComún.plugins.datalabels,
                    color: function(context) { return context.dataset.borderColor; },
                    anchor: 'center', align: 'top', offset: 8
                }
            }
        }
    });
    
    // --- 6.2 Top Divisiones CORREGIDO (Punto 3: Comparativo AA vs AP, Ordenado Desc) ---
    const ctxDiv = document.getElementById('chartDiv').getContext('2d');
    
    // Agrupamos act y pas por división
    let resumenDiv = {};
    vData.forEach(d => {
        if (!resumenDiv[d.division]) resumenDiv[d.division] = { act: 0, pas: 0 };
        resumenDiv[d.division].act += d.actual;
        resumenDiv[d.division].pas += d.pasado;
    });

    // Convertimos a array, filtramos ceros y ordenamos de mayor a menor por Venta Actual
    let arrDiv = Object.entries(resumenDiv)
        .map(([name, data]) => ({ name, ...data }))
        .filter(d => d.act > 0 || d.pas > 0)
        .sort((a, b) => b.act - a.act); // ORDENADO DE MAYOR A MENOR

    if(graficoDiv) graficoDiv.destroy();
    graficoDiv = new Chart(ctxDiv, {
        type: 'bar',
        data: {
            labels: arrDiv.map(d => d.name),
            datasets: [
                { label: 'Venta Actual', data: arrDiv.map(d => d.act), backgroundColor: '#012094' },
                { label: 'Venta Pasada', data: arrDiv.map(d => d.pas), backgroundColor: '#E1251B' } // COMPARATIVO
            ]
        },
        options: layoutGráficosComún
    });

    // --- 6.3 Top Categorías CORREGIDO (Punto 3: Comparativo, Ordenado Desc, Nombres visibles) ---
    const ctxCat = document.getElementById('chartCat').getContext('2d');
    
    // Agrupamos por categoría
    let resumenCat = {};
    vData.forEach(d => {
        if (!resumenCat[d.categoria]) resumenCat[d.categoria] = { act: 0, pas: 0 };
        resumenCat[d.categoria].act += d.actual;
        resumenCat[d.categoria].pas += d.pasado;
    });

    // Ordenamos y sacamos Top 10
    let arrCat = Object.entries(resumenCat)
        .map(([name, data]) => ({ name, ...data }))
        .filter(d => d.act > 0 || d.pas > 0)
        .sort((a, b) => b.act - a.act); // ORDENADO DE MAYOR A MENOR
    
    const top10Cat = arrCat.slice(0, 10);

    if(graficoCat) graficoCat.destroy();
    graficoCat = new Chart(ctxCat, {
        type: 'bar',
        data: {
            labels: top10Cat.map(d => d.name),
            datasets: [
                { label: 'Venta Actual', data: top10Cat.map(d => d.act), backgroundColor: '#012094' },
                { label: 'Venta Pasada', data: top10Cat.map(d => d.pas), backgroundColor: '#E1251B' } // COMPARATIVO
            ]
        },
        options: layoutGráficosComún
    });

    // --- 6.4 TABLA PESTAÑA 2: Resumen Gerencial Tiendas CORREGIDA (Punto 1 y 2: Unificada y Visible) ---
    const tbodyTiendas = document.querySelector('#tablaGerencialTiendas tbody');
    tbodyTiendas.innerHTML = '';
    
    // Cruzamos bases: Lista única de tiendas presentes en Ventas o Saldos filtrados
    let tiendasCruzadas = [...new Set([...vData.map(d => d.tienda), ...sData.map(d => d.tienda)])].sort();

    tiendasCruzadas.forEach(t => {
        // Datos Ventas
        let vActT = vData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.actual, 0);
        let vPasT = vData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.pasado, 0);
        let difVT = vActT - vPasT;

        // Datos Saldos
        let sActT = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_actual, 0);
        let sPasT = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_pasado, 0);
        let difST = sActT - sPasT;

        if (vActT !== 0 || vPasT !== 0 || sActT !== 0 || sPasT !== 0) {
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${t}</td>
                <td>${formatNumber(vActT)}</td>
                <td>${formatNumber(vPasT)}</td>
                <td class="${difVT >= 0 ? 'pos' : 'neg'}" style="border-right: 2px solid #eee;">${difVT > 0 ? '+' : ''}${formatNumber(difVT)}</td>
                <td>${formatNumber(sActT)}</td>
                <td>${formatNumber(sPasT)}</td>
                <td class="${difST >= 0 ? 'pos' : 'neg'}">${difST > 0 ? '+' : ''}${formatNumber(difST)}</td>
            `;
            tbodyTiendas.appendChild(tr);
        }
    });

    // --- 6.5 TABLA PESTAÑA 3: Detalle Unificado por GRUPO (Punto 1 y 6: Div/Cat unificados) ---
    const tbodyGrupos = document.querySelector('#tablaDetalleGrupos tbody');
    tbodyGrupos.innerHTML = '';
    
    // Objeto maestro para cruzar grupos (División + Categoría)
    let resumenGruposMaster = {};

    // Inyectar datos de Ventas al maestro
    vData.forEach(d => {
        let clave = d.division + " / " + d.categoria;
        if (!resumenGruposMaster[clave]) resumenGruposMaster[clave] = { divCat: clave, vAct: 0, vPas: 0, sAct: 0, sPas: 0 };
        resumenGruposMaster[clave].vAct += d.actual;
        resumenGruposMaster[clave].vPas += d.pasado;
    });

    // Inyectar datos de Saldos al maestro
    sData.forEach(d => {
        let clave = d.division + " / " + d.categoria;
        if (!resumenGruposMaster[clave]) resumenGruposMaster[clave] = { divCat: clave, vAct: 0, vPas: 0, sAct: 0, sPas: 0 };
        resumenGruposMaster[clave].sAct += d.saldo_actual;
        resumenGruposMaster[clave].sPas += d.saldo_pasado;
    });

    // Convertir a array y ordenar alfabéticamente por grupo
    let arrGrupos = Object.values(resumenGruposMaster).sort((a, b) => a.divCat.localeCompare(b.divCat));

    arrGrupos.forEach(g => {
        let difVG = g.vAct - g.vPas;
        let difSG = g.sAct - g.sPas;

        if (g.vAct !== 0 || g.vPas !== 0 || g.sAct !== 0 || g.sPas !== 0) {
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${g.divCat}</td>
                <td>${formatNumber(g.vAct)}</td>
                <td>${formatNumber(g.vPas)}</td>
                <td class="${difVG >= 0 ? 'pos' : 'neg'}" style="border-right: 2px solid #eee;">${difVG > 0 ? '+' : ''}${formatNumber(difVG)}</td>
                <td>${formatNumber(g.sAct)}</td>
                <td>${formatNumber(g.sPas)}</td>
                <td class="${difSG >= 0 ? 'pos' : 'neg'}">${difSG > 0 ? '+' : ''}${formatNumber(difSG)}</td>
            `;
            tbodyGrupos.appendChild(tr);
        }
    });
}
