Chart.register(ChartDataLabels);

let datosVentasRaw = [];
let datosSaldosRaw = [];
let fMes = 'Todos', fTienda = 'Todos', fDiv = 'Todos', fCat = 'Todos';

const mesesVal = { 'enero':1, 'febrero':2, 'marzo':3, 'abril':4, 'mayo':5, 'junio':6, 'julio':7, 'agosto':8, 'septiembre':9, 'octubre':10, 'noviembre':11, 'diciembre':12 };

// Estructura para manejar el estado, paginación, orden y búsqueda de cada tabla
const state = {
    divisiones: { data: [], filteredData: [], page: 1, limit: 25, sortCol: 'vAct', sortAsc: false, tableId: 'tablaResumenDivisiones', label: 'divisiones', search: '' },
    categorias: { data: [], filteredData: [], page: 1, limit: 25, sortCol: 'vAct', sortAsc: false, tableId: 'tablaResumenCategorias', label: 'categorías', search: '' },
    tiendas:    { data: [], filteredData: [], page: 1, limit: 25, sortCol: 'vAct', sortAsc: false, tableId: 'tablaGerencialTiendas', label: 'tiendas', search: '' },
    grupos:     { data: [], filteredData: [], page: 1, limit: 25, sortCol: 'vAct', sortAsc: false, tableId: 'tablaDetalleGrupos', label: 'grupos', search: '' }
};

function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return new Intl.NumberFormat('en-US').format(Math.round(num));
}

// ================= NAVEGACIÓN Y FILTROS =================

function openTab(evt, tabName) {
    let tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";
    let tablinks = document.getElementsByClassName("tab-button");
    for (let i = 0; i < tablinks.length; i++) tablinks[i].className = tablinks[i].className.replace(" active", "");
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
    if(tabName === 'tab-graficos') actualizarTablero(false);
}

function limpiarFiltros() {
    fMes = 'Todos'; fTienda = 'Todos'; fDiv = 'Todos'; fCat = 'Todos';
    document.getElementById('f-mes').value = 'Todos';
    document.getElementById('f-tienda').value = 'Todos';
    document.getElementById('f-division').value = 'Todos';
    document.getElementById('f-categoria').value = 'Todos';
    actualizarTablero(true);
}

function inicializarFiltrosDOM() {
    ['f-mes', 'f-tienda', 'f-division', 'f-categoria'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            if(id === 'f-mes') fMes = e.target.value;
            if(id === 'f-tienda') fTienda = e.target.value;
            if(id === 'f-division') fDiv = e.target.value;
            if(id === 'f-categoria') fCat = e.target.value;
            actualizarTablero(true);
        });
    });
}

function getMesNum(m) { return mesesVal[m.toLowerCase()] || 99; }

function actualizarFiltrosDisponibles(vFiltradas) {
    let mesesAct = [...new Set(datosVentasRaw.map(d => d.mes))].sort((a, b) => getMesNum(a) - getMesNum(b));
    let tiendasAct = [...new Set(datosVentasRaw.map(d => d.tienda))].sort();
    let divAct = fTienda === 'Todos' ? [...new Set(datosVentasRaw.map(d => d.division))] : [...new Set(vFiltradas.map(d => d.division))];
    let catAct = (fTienda === 'Todos' && fDiv === 'Todos') ? [...new Set(datosVentasRaw.map(d => d.categoria))] : [...new Set(vFiltradas.map(d => d.categoria))];

    llenarSelectManteniendoValor('f-mes', mesesAct, fMes);
    llenarSelectManteniendoValor('f-tienda', tiendasAct, fTienda);
    llenarSelectManteniendoValor('f-division', divAct.sort(), fDiv);
    llenarSelectManteniendoValor('f-categoria', catAct.sort(), fCat);
}

function llenarSelectManteniendoValor(id, opciones, valorActual) {
    const select = document.getElementById(id);
    select.innerHTML = '<option value="Todos">-- Todos --</option>';
    opciones.forEach(op => {
        let el = document.createElement('option');
        el.value = el.text = op;
        if(op === valorActual) el.selected = true;
        select.appendChild(el);
    });
}

// ================= CARGA DE DATOS (PARTICIONADO Y ANTI-COMAS) =================

async function cargarVentasArchivo(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return []; 
        const text = await response.text();
        
        return new Promise((resolve) => {
            Papa.parse(text, {
                header: false, delimiter: ';',
                complete: function(resultados) {
                    const filas = resultados.data;
                    if (filas.length < 2) { resolve([]); return; }
                    const metricasRow = filas[1];
                    let procesado = [];
                    for(let i = 2; i < filas.length; i++) {
                        const fila = filas[i];
                        if(!fila || fila.length < 7 || !fila[0]) continue;
                        
                        let tienda = fila[3] ? fila[3].toUpperCase() : "";
                        if(tienda === 'MEGATIENDA 2 AEC') tienda = 'MEGABODEGA-AEC'; // Corrección nomenclatura

                        const division = fila[4], categoria = fila[5];
                        const grupoReal = fila[6] || fila[2] || (division + " - " + categoria); 

                        for(let c = 7; c < fila.length; c++) {
                            if (metricasRow[c] === 'Venta_Und_Anterior') {
                                let mes = filas[0][c] ? filas[0][c].trim() : "";
                                let pasadoStr = fila[c] ? fila[c].toString().replace(/,/g, '') : "0";
                                let pasado = parseFloat(pasadoStr) || 0;
                                let actualStr = fila[c+1] ? fila[c+1].toString().replace(/,/g, '') : "0";
                                let actual = parseFloat(actualStr) || 0; 
                                
                                if ((pasado !== 0 || actual !== 0) && mes !== "") {
                                    mes = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();
                                    procesado.push({ mes, tienda, division, categoria, grupo: grupoReal, pasado, actual });
                                }
                            }
                        }
                    }
                    resolve(procesado);
                }
            });
        });
    } catch (error) {
        return [];
    }
}

async function cargarTodasLasVentas() {
    const ventas1 = await cargarVentasArchivo('ventas_1.csv');
    const ventas2 = await cargarVentasArchivo('ventas_2.csv');
    const ventas3 = await cargarVentasArchivo('ventas_3.csv');
    return [...ventas1, ...ventas2, ...ventas3];
}

function cargarSaldos() {
    return new Promise((resolver, rechazar) => {
        Papa.parse('saldos.csv', {
            download: true, header: true, delimiter: ';', dynamicTyping: true,
            complete: function(resultados) {
                let procesado = [];
                resultados.data.forEach(fila => {
                    if(fila.Name) {
                        let nombreTienda = fila.Name.toUpperCase();
                        if(nombreTienda === 'MEGATIENDA 2 AEC') nombreTienda = 'MEGABODEGA-AEC';

                        let sActStr = fila.Saldo_Total_Actual ? fila.Saldo_Total_Actual.toString().replace(/,/g, '') : "0";
                        let sAct = parseFloat(sActStr) || 0; 
                        let sPasStr = fila.Saldo_Total_Anterior ? fila.Saldo_Total_Anterior.toString().replace(/,/g, '') : "0";
                        let sPas = parseFloat(sPasStr) || 0; 

                        // SEPARACIÓN DE CEDIS VS TIENDAS
                        let isCedis = nombreTienda.includes('MEGABODEGA');
                        let sActCedis = isCedis ? sAct : 0;
                        let sActTiendas = !isCedis ? sAct : 0;

                        const grupoReal = fila.Grupo || fila.Group || (fila.Division + " - " + fila.Categoria); 
                        procesado.push({ 
                            tienda: nombreTienda, 
                            division: fila.Division, 
                            categoria: fila.Categoria, 
                            grupo: grupoReal, 
                            sAct: sAct, 
                            sPas: sPas,
                            sActCedis: sActCedis,
                            sActTiendas: sActTiendas
                        });
                    }
                });
                resolver(procesado);
            }, error: rechazar
        });
    });
}

// INICIALIZACIÓN
Promise.all([cargarTodasLasVentas(), cargarSaldos()]).then(archivos => {
    datosVentasRaw = archivos[0];
    datosSaldosRaw = archivos[1];
    
    let mesesDisponibles = [...new Set(datosVentasRaw.map(d => d.mes))].sort((a, b) => getMesNum(a) - getMesNum(b));
    if(mesesDisponibles.length > 0) {
        document.getElementById('badge-periodo').innerText = `PERÍODO: ${mesesDisponibles[0]} a ${mesesDisponibles[mesesDisponibles.length-1]}`;
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('kpi-container').style.display = 'grid';
    document.getElementById('filtros-wrapper').style.display = 'flex';
    document.getElementById('tabs-container').style.display = 'flex';
    document.getElementById('graficos-container').style.display = 'block';
    
    inicializarFiltrosDOM();
    actualizarTablero(true);
}).catch(console.error);

// ================= ACTUALIZACIÓN DE DATOS Y KPIs =================

function actualizarTablero(cascada = false) {
    let vFiltradas = datosVentasRaw.filter(d => (fMes === 'Todos' || d.mes === fMes) && (fTienda === 'Todos' || d.tienda === fTienda) && (fDiv === 'Todos' || d.division === fDiv) && (fCat === 'Todos' || d.categoria === fCat));
    let vTend = datosVentasRaw.filter(d => (fTienda === 'Todos' || d.tienda === fTienda) && (fDiv === 'Todos' || d.division === fDiv) && (fCat === 'Todos' || d.categoria === fCat));
    
    // AQUÍ ESTÁ LA MAGIA: El filtro de saldo ahora hace a la bodega "inmune" al filtro de tienda
    let sFiltrados = datosSaldosRaw.filter(d => {
        let isCedis = d.tienda.includes('MEGABODEGA') || d.tienda.includes('CEDIS');
        let matchTienda = (fTienda === 'Todos' || d.tienda === fTienda || isCedis);
        let matchDiv = (fDiv === 'Todos' || d.division === fDiv);
        let matchCat = (fCat === 'Todos' || d.categoria === fCat);
        return matchTienda && matchDiv && matchCat;
    });

    if(cascada) actualizarFiltrosDisponibles(datosVentasRaw.filter(d => (fTienda === 'Todos' || d.tienda === fTienda) && (fDiv === 'Todos' || d.division === fDiv)));

    actualizarKPIs(vFiltradas, sFiltrados);
    dibujarGraficos(vFiltradas, vTend);
    prepararDatosTablas(vFiltradas, sFiltrados);
}

function actualizarKPIs(vData, sData) {
    let vAct = vData.reduce((s, d) => s + d.actual, 0);
    let vPas = vData.reduce((s, d) => s + d.pasado, 0);
    let vDif = vAct - vPas;
    let sAct = sData.reduce((s, d) => s + d.sAct, 0);
    let sPas = sData.reduce((s, d) => s + d.sPas, 0);
    let sDif = sAct - sPas;

    document.getElementById('kpi-ventas-act').innerText = formatNumber(vAct);
    document.getElementById('kpi-ventas-pas').innerText = formatNumber(vPas);
    let divVDif = document.getElementById('kpi-ventas-dif');
    divVDif.innerText = (vDif > 0 ? '+' : '') + formatNumber(vDif);
    divVDif.className = 'kpi-dif ' + (vDif >= 0 ? 'pos' : 'neg');

    document.getElementById('kpi-saldos-act').innerText = formatNumber(sAct);
    document.getElementById('kpi-saldos-pas').innerText = formatNumber(sPas);
    let divSDif = document.getElementById('kpi-saldos-dif');
    divSDif.innerText = (sDif > 0 ? '+' : '') + formatNumber(sDif);
    divSDif.className = 'kpi-dif ' + (sDif >= 0 ? 'pos' : 'neg');
}

// ================= GRÁFICOS =================

const configBaseGrafico = {
    responsive: true, maintainAspectRatio: false,
    layout: { padding: { top: 40, right: 20, bottom: 0, left: 20 } },
    scales: { x: { grid: { display: false }, ticks: { font: { family: 'Montserrat', weight: 'bold', size: 10 } } }, y: { display: false, grid: { display: false }, min: 0 } },
    plugins: { legend: { position: 'top', labels: { font: { family: 'Montserrat', weight: 'bold' } } } }
};

let graficoLinea, graficoDiv, graficoCat;

function dibujarGraficos(vData, vTendenciaData) {
    const ctxLinea = document.getElementById('chartLine').getContext('2d');
    let mesesOrdenados = [...new Set(vTendenciaData.map(item => item.mes))].sort((a, b) => getMesNum(a) - getMesNum(b));
    const totActual = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.actual, 0));
    const totPasado = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.pasado, 0));

    if(graficoLinea) graficoLinea.destroy();
    graficoLinea = new Chart(ctxLinea, {
        type: 'line',
        data: { labels: mesesOrdenados, datasets: [ { label: 'Año Actual', data: totActual, borderColor: '#012094', backgroundColor: '#012094', tension: 0.3, borderWidth: 4, pointRadius: 5 }, { label: 'Año Pasado', data: totPasado, borderColor: '#E1251B', backgroundColor: '#E1251B', tension: 0.3, borderWidth: 4, pointRadius: 5 } ] }, 
        options: { ...configBaseGrafico, layout: { padding: { top: 40, right: 40, bottom: 20, left: 40 } }, plugins: { ...configBaseGrafico.plugins, datalabels: { color: function(context) { return context.dataset.borderColor; }, anchor: function(context) { return context.datasetIndex === 0 ? 'end' : 'start'; }, align: function(context) { return context.datasetIndex === 0 ? 'top' : 'bottom'; }, offset: 6, font: { family: 'Montserrat', weight: '800', size: 11 }, formatter: function(value) { return formatNumber(value); } } } }
    });
    
    const configBarrasTop = JSON.parse(JSON.stringify(configBaseGrafico));
    configBarrasTop.layout.padding = { top: 60, right: 10, bottom: 0, left: 10 };
    configBarrasTop.plugins.datalabels = { color: '#444', anchor: 'end', align: 'end', offset: 5, font: { family: 'Montserrat', weight: '800', size: 10 }, rotation: -45, formatter: function(value) { return formatNumber(value); } };

    const ctxDiv = document.getElementById('chartDiv').getContext('2d');
    let resDiv = {};
    vData.forEach(d => { if (!resDiv[d.division]) resDiv[d.division] = { act: 0, pas: 0 }; resDiv[d.division].act += d.actual; resDiv[d.division].pas += d.pasado; });
    let t10Div = Object.entries(resDiv).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.act - a.act).slice(0, 10);
    if(graficoDiv) graficoDiv.destroy();
    graficoDiv = new Chart(ctxDiv, { type: 'bar', data: { labels: t10Div.map(d => d.name), datasets: [ { label: 'Venta Actual', data: t10Div.map(d => d.act), backgroundColor: '#012094' }, { label: 'Venta Pasada', data: t10Div.map(d => d.pas), backgroundColor: '#E1251B' } ] }, options: configBarrasTop });

    const ctxCat = document.getElementById('chartCat').getContext('2d');
    let resCat = {};
    vData.forEach(d => { if (!resCat[d.categoria]) resCat[d.categoria] = { act: 0, pas: 0 }; resCat[d.categoria].act += d.actual; resCat[d.categoria].pas += d.pasado; });
    let t10Cat = Object.entries(resCat).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.act - a.act).slice(0, 10);
    if(graficoCat) graficoCat.destroy();
    graficoCat = new Chart(ctxCat, { type: 'bar', data: { labels: t10Cat.map(d => d.name), datasets: [ { label: 'Venta Actual', data: t10Cat.map(d => d.act), backgroundColor: '#012094' }, { label: 'Venta Pasada', data: t10Cat.map(d => d.pas), backgroundColor: '#E1251B' } ] }, options: configBarrasTop });
}

// ================= TABLAS (BÚSQUEDA, ORDEN Y RENDERIZADO) =================

function procesarAgrupacion(vData, sData, keyName) {
    let map = {};
    vData.forEach(d => { 
        let k = d[keyName]; 
        if(!map[k]) map[k] = {nombre: k, vAct:0, vPas:0, sAct:0, sPas:0, sActCedis:0, sActTiendas:0}; 
        map[k].vAct += d.actual; map[k].vPas += d.pasado; 
    });
    sData.forEach(d => { 
        let k = d[keyName]; 
        if(!map[k]) map[k] = {nombre: k, vAct:0, vPas:0, sAct:0, sPas:0, sActCedis:0, sActTiendas:0}; 
        map[k].sAct += d.sAct; map[k].sPas += d.sPas; 
        map[k].sActCedis += d.sActCedis; map[k].sActTiendas += d.sActTiendas;
    });
    return Object.values(map).map(g => { g.difV = g.vAct - g.vPas; g.difS = g.sAct - g.sPas; return g; });
}

function prepararDatosTablas(vData, sData) {
    state.divisiones.data = procesarAgrupacion(vData, sData, 'division');
    state.categorias.data = procesarAgrupacion(vData, sData, 'categoria');
    state.tiendas.data = procesarAgrupacion(vData, sData, 'tienda');
    state.grupos.data = procesarAgrupacion(vData, sData, 'grupo');

    Object.keys(state).forEach(k => {
        state[k].filteredData = [...state[k].data]; // Inicializa datos filtrados
        state[k].filteredData = ordenarDatos(state[k].filteredData, state[k].sortCol, state[k].sortAsc);
        state[k].page = 1;
        
        // Mantener la búsqueda si existía
        if(state[k].search) buscarTabla(k, state[k].search);
        else renderTabla(k);
        
        actualizarIconosOrden(k, state[k].sortCol);
    });
}

function ordenarDatos(dataset, sortCol, sortAsc) {
    return dataset.sort((a, b) => {
        let valA = a[sortCol], valB = b[sortCol];
        if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortAsc ? valA - valB : valB - valA;
    });
}

function ordenarTabla(tablaKey, col) {
    let s = state[tablaKey];
    if (s.sortCol === col) s.sortAsc = !s.sortAsc;
    else { s.sortCol = col; s.sortAsc = false; }
    
    // Ordena los datos filtrados
    s.filteredData = ordenarDatos(s.filteredData, s.sortCol, s.sortAsc);
    s.page = 1; // Vuelve a la primera página al ordenar
    renderTabla(tablaKey);
    actualizarIconosOrden(tablaKey, col);
}

function buscarTabla(tablaKey, valor) {
    let s = state[tablaKey];
    s.search = valor.toLowerCase().trim();
    if(s.search === '') {
        s.filteredData = [...s.data];
    } else {
        s.filteredData = s.data.filter(item => item.nombre.toLowerCase().includes(s.search));
    }
    s.filteredData = ordenarDatos(s.filteredData, s.sortCol, s.sortAsc);
    s.page = 1;
    renderTabla(tablaKey);
}

function actualizarIconosOrden(tablaKey, col) {
    document.querySelectorAll(`#${state[tablaKey].tableId} .sort-icon`).forEach(el => { el.innerHTML = ''; el.classList.remove('active'); });
    let icon = document.getElementById(`sort-${tablaKey}-${col}`);
    if(icon) { icon.innerHTML = state[tablaKey].sortAsc ? '&#9650;' : '&#9660;'; icon.classList.add('active'); }
}

function cambiarLimite(tablaKey) {
    state[tablaKey].limit = parseInt(document.getElementById(`limit-${tablaKey}`).value);
    state[tablaKey].page = 1; renderTabla(tablaKey);
}

function cambiarPagina(tablaKey, dir) {
    let s = state[tablaKey];
    const maxPage = Math.ceil(s.filteredData.length / s.limit);
    if (s.page + dir >= 1 && s.page + dir <= maxPage) { s.page += dir; renderTabla(tablaKey); }
}

function renderTabla(tablaKey) {
    let s = state[tablaKey];
    const tbody = document.querySelector(`#${s.tableId} tbody`); tbody.innerHTML = '';
    const start = (s.page - 1) * s.limit;
    
    let itemsToRender = s.filteredData.slice(start, start + s.limit);
    
    itemsToRender.forEach(item => {
        let tr = document.createElement('tr');
        
        let htmlBase = `<td>${item.nombre}</td>
                        <td>${formatNumber(item.vAct)}</td>
                        <td>${formatNumber(item.vPas)}</td>
                        <td class="${item.difV >= 0 ? 'pos' : 'neg'}">${item.difV > 0 ? '+' : ''}${formatNumber(item.difV)}</td>`;
                        
        if(tablaKey !== 'grupos') {
            // Tiendas, Divisiones, Categorías tienen desglose de CEDIS
            htmlBase += `<td style="color: #012094; font-weight: 800; background-color: rgba(1, 32, 148, 0.05);">${formatNumber(item.sActTiendas)}</td>
                         <td style="color: #E1251B; font-weight: 800; background-color: rgba(225, 37, 27, 0.05);">${formatNumber(item.sActCedis)}</td>`;
        }
        
        htmlBase += `<td>${formatNumber(item.sAct)}</td>
                     <td>${formatNumber(item.sPas)}</td>
                     <td class="${item.difS >= 0 ? 'pos' : 'neg'}">${item.difS > 0 ? '+' : ''}${formatNumber(item.difS)}</td>`;
                     
        tr.innerHTML = htmlBase;
        
        // Efecto visual al hacer clic
        tr.onclick = function() {
            let siblings = this.parentNode.children;
            for(let sib of siblings) { if(sib !== this) sib.classList.remove('row-selected'); }
            this.classList.toggle('row-selected');
        };

        tbody.appendChild(tr);
    });
    
    document.getElementById(`info-${tablaKey}`).innerText = `Página ${s.page} de ${Math.ceil(s.filteredData.length / s.limit) || 1} (${s.filteredData.length} resultados)`;
}
