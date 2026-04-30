Chart.register(ChartDataLabels);

let datosVentasRaw = [];
let datosSaldosRaw = [];
let fMes = 'Todos', fTienda = 'Todos', fDiv = 'Todos', fCat = 'Todos';

const mesesVal = { 'enero':1, 'febrero':2, 'marzo':3, 'abril':4, 'mayo':5, 'junio':6, 'julio':7, 'agosto':8, 'septiembre':9, 'octubre':10, 'noviembre':11, 'diciembre':12 };

let stateTiendas = { data: [], page: 1, limit: 25 };
let stateGrupos = { data: [], page: 1, limit: 25 };

function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return new Intl.NumberFormat('en-US').format(Math.round(num));
}

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
                    const grupoReal = fila[6] || fila[2] || (division + " - " + categoria); 

                    for(let c = 7; c < fila.length; c++) {
                        if (metricasRow[c] === 'Venta_Und_Anterior') {
                            let mes = mesesRow[c] ? mesesRow[c].trim() : "";
                            let pasado = parseFloat(fila[c]) || 0;
                            let actual = parseFloat(fila[c+1]) || 0; 
                            if ((pasado !== 0 || actual !== 0) && mes !== "") {
                                mes = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();
                                procesado.push({ mes, tienda, division, categoria, grupo: grupoReal, pasado, actual });
                            }
                        }
                    }
                }
                resolver(procesado);
            }, error: rechazar
        });
    });
}

function cargarSaldos() {
    return new Promise((resolver, rechazar) => {
        Papa.parse('saldos.csv', {
            download: true, header: true, delimiter: ';', dynamicTyping: true,
            complete: function(resultados) {
                let procesado = [];
                resultados.data.forEach(fila => {
                    if(fila.Name) {
                        let sAct = parseFloat(fila.Saldo_Total_Actual) || 0; 
                        let sPas = parseFloat(fila.Saldo_Total_Anterior) || 0; 
                        const grupoReal = fila.Grupo || fila.Group || (fila.Division + " - " + fila.Categoria); 
                        procesado.push({ tienda: fila.Name, division: fila.Division, categoria: fila.Categoria, grupo: grupoReal, sAct: sAct, sPas: sPas });
                    }
                });
                resolver(procesado);
            }, error: rechazar
        });
    });
}

Promise.all([cargarVentas(), cargarSaldos()]).then(archivos => {
    datosVentasRaw = archivos[0];
    datosSaldosRaw = archivos[1];
    document.getElementById('loading').style.display = 'none';
    document.getElementById('kpi-container').style.display = 'grid';
    document.getElementById('filtros-wrapper').style.display = 'flex';
    document.getElementById('tabs-container').style.display = 'flex';
    document.getElementById('graficos-container').style.display = 'block';
    
    inicializarFiltrosDOM();
    actualizarTablero(true);
}).catch(console.error);

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

let graficoLinea, graficoDiv, graficoCat;

function actualizarTablero(cascada = false) {
    let vFiltradas = datosVentasRaw.filter(d => (fMes === 'Todos' || d.mes === fMes) && (fTienda === 'Todos' || d.tienda === fTienda) && (fDiv === 'Todos' || d.division === fDiv) && (fCat === 'Todos' || d.categoria === fCat));
    let vTend = datosVentasRaw.filter(d => (fTienda === 'Todos' || d.tienda === fTienda) && (fDiv === 'Todos' || d.division === fDiv) && (fCat === 'Todos' || d.categoria === fCat));
    let sFiltrados = datosSaldosRaw.filter(d => (fTienda === 'Todos' || d.tienda === fTienda) && (fDiv === 'Todos' || d.division === fDiv) && (fCat === 'Todos' || d.categoria === fCat));

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

const configBaseGrafico = {
    responsive: true, maintainAspectRatio: false,
    layout: { padding: { top: 40, right: 20, bottom: 0, left: 20 } },
    scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Montserrat', weight: 'bold', size: 10 } } },
        y: { display: false, grid: { display: false }, min: 0 }
    },
    plugins: {
        legend: { position: 'top', labels: { font: { family: 'Montserrat', weight: 'bold' } } }
    }
};

function dibujarGraficos(vData, vTendenciaData) {
    
    // --- LÍNEA DE TIEMPO ---
    const ctxLinea = document.getElementById('chartLine').getContext('2d');
    let mesesOrdenados = [...new Set(vTendenciaData.map(item => item.mes))].sort((a, b) => getMesNum(a) - getMesNum(b));
    
    const totActual = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.actual, 0));
    const totPasado = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.pasado, 0));

    if(graficoLinea) graficoLinea.destroy();
    graficoLinea = new Chart(ctxLinea, {
        type: 'line',
        data: {
            labels: mesesOrdenados,
            datasets: [
                { label: 'Año Actual', data: totActual, borderColor: '#012094', backgroundColor: '#012094', tension: 0.3, borderWidth: 4, pointRadius: 5 },
                { label: 'Año Pasado', data: totPasado, borderColor: '#E1251B', backgroundColor: '#E1251B', tension: 0.3, borderWidth: 4, pointRadius: 5 }
            ]
        }, 
        options: {
            ...configBaseGrafico,
            layout: { padding: { top: 40, right: 30, bottom: 20, left: 30 } },
            plugins: {
                ...configBaseGrafico.plugins,
                datalabels: {
                    color: function(context) { return context.dataset.borderColor; },
                    anchor: function(context) { return context.datasetIndex === 0 ? 'end' : 'start'; },
                    align: function(context) { return context.datasetIndex === 0 ? 'top' : 'bottom'; },
                    offset: 6, font: { family: 'Montserrat', weight: '800', size: 11 },
                    formatter: function(value) { return formatNumber(value); }
                }
            }
        }
    });
    
    const configBarrasTop = JSON.parse(JSON.stringify(configBaseGrafico));
    configBarrasTop.layout.padding = { top: 60, right: 10, bottom: 0, left: 10 };
    configBarrasTop.plugins.datalabels = {
        color: '#444', anchor: 'end', align: 'end', offset: 5,
        font: { family: 'Montserrat', weight: '800', size: 10 },
        rotation: -45,
        formatter: function(value) { return formatNumber(value); }
    };

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

function prepararDatosTablas(vData, sData) {
    let tiendasMap = {};
    vData.forEach(d => {
        if (!tiendasMap[d.tienda]) tiendasMap[d.tienda] = { vAct: 0, vPas: 0, sAct: 0, sPas: 0 };
        tiendasMap[d.tienda].vAct += d.actual;
        tiendasMap[d.tienda].vPas += d.pasado;
    });
    sData.forEach(d => {
        if (!tiendasMap[d.tienda]) tiendasMap[d.tienda] = { vAct: 0, vPas: 0, sAct: 0, sPas: 0 };
        tiendasMap[d.tienda].sAct += d.sAct;
        tiendasMap[d.tienda].sPas += d.sPas;
    });
    stateTiendas.data = Object.entries(tiendasMap)
        .map(([tienda, vals]) => ({ tienda, ...vals }))
        .filter(i => i.vAct !== 0 || i.vPas !== 0 || i.sAct !== 0 || i.sPas !== 0)
        .sort((a, b) => a.tienda.localeCompare(b.tienda));

    let gruposMap = {};
    vData.forEach(d => { if (!gruposMap[d.grupo]) gruposMap[d.grupo] = { nombre: d.grupo, vAct: 0, vPas: 0, sAct: 0, sPas: 0 }; gruposMap[d.grupo].vAct += d.actual; gruposMap[d.grupo].vPas += d.pasado; });
    sData.forEach(d => { if (!gruposMap[d.grupo]) gruposMap[d.grupo] = { nombre: d.grupo, vAct: 0, vPas: 0, sAct: 0, sPas: 0 }; gruposMap[d.grupo].sAct += d.sAct; gruposMap[d.grupo].sPas += d.sPas; });
    stateGrupos.data = Object.values(gruposMap).sort((a, b) => a.nombre.localeCompare(b.nombre));

    stateTiendas.page = 1; stateGrupos.page = 1;
    renderTablaTiendas(); renderTablaGrupos();
}

function cambiarLimite(tipo) {
    let val = parseInt(document.getElementById(`limit-${tipo}`).value);
    if(tipo === 'tiendas') { stateTiendas.limit = val; stateTiendas.page = 1; renderTablaTiendas(); }
    if(tipo === 'grupos') { stateGrupos.limit = val; stateGrupos.page = 1; renderTablaGrupos(); }
}

function cambiarPagina(tipo, dir) {
    if(tipo === 'tiendas') {
        const maxPage = Math.ceil(stateTiendas.data.length / stateTiendas.limit);
        if (stateTiendas.page + dir >= 1 && stateTiendas.page + dir <= maxPage) { stateTiendas.page += dir; renderTablaTiendas(); }
    }
    if(tipo === 'grupos') {
        const maxPage = Math.ceil(stateGrupos.data.length / stateGrupos.limit);
        if (stateGrupos.page + dir >= 1 && stateGrupos.page + dir <= maxPage) { stateGrupos.page += dir; renderTablaGrupos(); }
    }
}

function crearFila(item, keyName) {
    let difV = item.vAct - item.vPas;
    let difS = item.sAct - item.sPas;
    let tr = document.createElement('tr');
    tr.innerHTML = `<td>${item[keyName]}</td><td>${formatNumber(item.vAct)}</td><td>${formatNumber(item.vPas)}</td><td class="${difV >= 0 ? 'pos' : 'neg'}" style="border-right: 2px solid #eee;">${difV > 0 ? '+' : ''}${formatNumber(difV)}</td><td>${formatNumber(item.sAct)}</td><td>${formatNumber(item.sPas)}</td><td class="${difS >= 0 ? 'pos' : 'neg'}">${difS > 0 ? '+' : ''}${formatNumber(difS)}</td>`;
    return tr;
}

function renderTablaTiendas() {
    const tbody = document.querySelector('#tablaGerencialTiendas tbody'); tbody.innerHTML = '';
    const startIndex = (stateTiendas.page - 1) * stateTiendas.limit;
    stateTiendas.data.slice(startIndex, startIndex + stateTiendas.limit).forEach(item => tbody.appendChild(crearFila(item, 'tienda')));
    document.getElementById('info-tiendas').innerText = `Página ${stateTiendas.page} de ${Math.ceil(stateTiendas.data.length / stateTiendas.limit) || 1} (${stateTiendas.data.length} registros)`;
}

function renderTablaGrupos() {
    const tbody = document.querySelector('#tablaDetalleGrupos tbody'); tbody.innerHTML = '';
    const startIndex = (stateGrupos.page - 1) * stateGrupos.limit;
    stateGrupos.data.slice(startIndex, startIndex + stateGrupos.limit).forEach(item => tbody.appendChild(crearFila(item, 'nombre')));
    document.getElementById('info-grupos').innerText = `Página ${stateGrupos.page} de ${Math.ceil(stateGrupos.data.length / stateGrupos.limit) || 1} (${stateGrupos.data.length} grupos)`;
}
