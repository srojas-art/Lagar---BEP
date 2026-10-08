// --- VARIABLES GLOBALES E INICIALIZACIÓN ---
let rolActual = 'CONSULTA';
let adminAutenticado = false;
let fotoBase64Capturada = "";
let streamCamara = null;
let modoCamaraActual = "user"; // "user" para frontal, "environment" para trasera

// Obtención de referencias globales a Firebase desde window.FirebaseDB
const getFB = () => window.FirebaseDB || {};

// Fincas Propias Definidas
const FINCAS_PROPIAS = ["F. EL OASIS", "LA PAMPA", "SAN CARLOS 2", "SAN CARLOS 3"];

// Carga inicial segura
let viajes = [];
let logReinicios = [];
let planificaciones = [];
let operadores = [];
let maestros = {
    productores: ["BODEGA SALENTEIN SA", "BODEGA EL PORTILLO", "FINCA LA CELIA", "AGRICOLA EL SOL"],
    variedades: ["CHARDONNAY", "MALBEC", "CABERNET SAUVIGNON", "PINOT NOIR", "SYRAH"],
    fincas: ["F. EL OASIS", "LA PAMPA", "SAN CARLOS 2", "SAN CARLOS 3", "FINCA LOS CEREZOS", "FINCA EL PORTILLO"],
    fletes: ["TRANSPORTE CUYO", "LOGISTICA EXPEDITO", "FLETES DEL VALLE"]
};

// Escuchador en tiempo real desde Firebase
function escucharCambiosFirebase() {
    const { db, ref, onValue } = getFB();
    if (!db || !ref || !onValue) {
        setTimeout(escucharCambiosFirebase, 300);
        return;
    }

    const appRef = ref(db, 'portillo_app');
    onValue(appRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            viajes = data.viajes || [];
            logReinicios = data.logReinicios || [];
            planificaciones = data.planificaciones || [];
            operadores = data.operadores || [
                { id: 1, nombre: "OPERADOR 1", pass: "1234" },
                { id: 2, nombre: "OPERADOR 2", pass: "1234" },
                { id: 3, nombre: "OPERADOR 3", pass: "1234" }
            ];
            if (data.maestros) maestros = data.maestros;
        } else {
            operadores = [
                { id: 1, nombre: "OPERADOR 1", pass: "1234" },
                { id: 2, nombre: "OPERADOR 2", pass: "1234" },
                { id: 3, nombre: "OPERADOR 3", pass: "1234" }
            ];
            guardarStorageCompleto();
        }

        // Actualizar la interfaz
        inicializarSelects();
        actualizarDashboard();
        renderizarPlanta();
        renderizarFinalizados();
        actualizarProximoViajeBadge();
        if (adminAutenticado) renderizarAdmin();
    });
}

// Guardar estado completo en Firebase
async function guardarStorageCompleto() {
    try {
        const { db, ref, set } = getFB();
        if (!db) return;
        await set(ref(db, 'portillo_app'), {
            viajes: viajes,
            logReinicios: logReinicios,
            planificaciones: planificaciones,
            operadores: operadores,
            maestros: maestros
        });
    } catch (error) {
        console.error("Error al guardar en Firebase:", error);
    }
}

// Guardar únicamente cambios en viajes
async function guardarStorageViajes() {
    try {
        const { db, ref, set } = getFB();
        if (!db) return;
        await set(ref(db, 'portillo_app/viajes'), viajes);
    } catch (error) {
        console.error("Error al guardar viajes en Firebase:", error);
    }
}

// Evento Principal de Carga del DOM
document.addEventListener("DOMContentLoaded", () => {
    escucharCambiosFirebase();
    iniciarCamara();
    aplicarPermisosRol();
    setInterval(actualizarTiemposPermanencia, 10000);
});

function cerrarSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
    }
}

function abrirModalLogin() {
    document.getElementById('login-select-rol').value = 'CONSULTA';
    evaluarCampoPasswordLogin();
    document.getElementById('modal-login-roles').classList.remove('hidden');
}

function cerrarModal(idModal) {
    const el = document.getElementById(idModal);
    if (el) el.classList.add('hidden');
}

function evaluarCampoPasswordLogin() {
    const rol = document.getElementById('login-select-rol').value;
    const groupPass = document.getElementById('group-login-pass');
    const inputPass = document.getElementById('login-input-pass');

    if (rol === 'CONSULTA') {
        groupPass.classList.add('hidden');
        inputPass.value = '';
    } else {
        groupPass.classList.remove('hidden');
        inputPass.value = '';
        inputPass.focus();
    }
}

function autenticarLoginModal() {
    const rolSeleccionado = document.getElementById('login-select-rol').value;
    const pass = document.getElementById('login-input-pass').value.trim();

    if (rolSeleccionado === 'CONSULTA') {
        rolActual = 'CONSULTA';
        adminAutenticado = false;
        aplicarPermisosRol();
        cerrarModal('modal-login-roles');
        return;
    }

    const esAdminValido = typeof validarAdministrador === 'function' ? validarAdministrador(pass) : (pass === 'admin123');

    if (rolSeleccionado === 'ADMIN') {
        if (esAdminValido) {
            rolActual = 'ADMIN';
            adminAutenticado = true;
            aplicarPermisosRol();
            cerrarModal('modal-login-roles');
            alert("✅ Sesión iniciada como ADMINISTRADOR GENERAL.");
        } else {
            alert("❌ Contraseña de Administrador incorrecta.");
        }
        return;
    }

    if (rolSeleccionado === 'OPERADOR') {
        const op = operadores.find(o => o.pass === pass);
        if (op || esAdminValido) {
            rolActual = 'OPERADOR';
            adminAutenticado = false;
            aplicarPermisosRol();
            cerrarModal('modal-login-roles');
            alert(`✅ Sesión iniciada como OPERADOR (${op ? op.nombre : 'ADMINISTRADOR'}).`);
        } else {
            alert("❌ Contraseña de Operador incorrecta.");
        }
    }
}

function cerrarSesionGlobal() {
    rolActual = 'CONSULTA';
    adminAutenticado = false;
    aplicarPermisosRol();
    mostrarPantalla('pantalla-inicio');
    alert("Sesión cerrada. Ha vuelto al modo CONSULTA.");
}

function aplicarPermisosRol() {
    const badge = document.getElementById('usuario-sesion-badge');
    const btnGuardarIngreso = document.getElementById('btn-guardar-ingreso');
    const btnCerrarGlobal = document.getElementById('btn-cerrar-sesion-global');
    const navBtnIngreso = document.getElementById('nav-btn-ingreso');
    const navBtnAdmin = document.getElementById('nav-btn-admin');

    if (badge) {
        if (rolActual === 'ADMIN') {
            badge.innerText = "ROL: ADMINISTRADOR GENERAL";
            badge.style.background = "#dbeafe";
            badge.style.color = "#1e3a8a";
        } else if (rolActual === 'OPERADOR') {
            badge.innerText = "ROL: OPERADOR";
            badge.style.background = "#dcfce7";
            badge.style.color = "#166534";
        } else {
            badge.innerText = "ROL: CONSULTA (SOLO LECTURA)";
            badge.style.background = "#f1f5f9";
            badge.style.color = "#475569";
        }
    }

    if (btnGuardarIngreso) btnGuardarIngreso.disabled = (rolActual === 'CONSULTA');
    if (btnCerrarGlobal) btnCerrarGlobal.classList.toggle('hidden', rolActual === 'CONSULTA');
    if (navBtnIngreso) navBtnIngreso.classList.toggle('hidden', rolActual === 'CONSULTA');
    if (navBtnAdmin) navBtnAdmin.classList.toggle('hidden', rolActual !== 'ADMIN');

    renderizarPlanta();
}

function mostrarPantalla(idPantalla, event) {
    if (rolActual === 'CONSULTA' && (idPantalla === 'pantalla-ingreso' || idPantalla === 'pantalla-admin')) {
        alert("🔒 Acceso denegado. Se requieren permisos de Operador o Administrador.");
        return;
    }

    if (rolActual === 'OPERADOR' && idPantalla === 'pantalla-admin') {
        alert("🔒 Acceso denegado. Se requieren permisos de Administrador General.");
        return;
    }

    document.querySelectorAll('.pantalla').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const el = document.getElementById(idPantalla);
    if (el) el.classList.remove('hidden');
    if (event && event.target) event.target.classList.add('active');

    if (idPantalla === 'pantalla-ingreso') iniciarCamara();
    if (idPantalla === 'pantalla-planta') renderizarPlanta();
    if (idPantalla === 'pantalla-finalizados') renderizarFinalizados();
    if (idPantalla === 'pantalla-admin' && adminAutenticado) renderizarAdmin();
}

function inicializarSelects() {
    llenarSelect('select-productor', maestros.productores);
    llenarSelect('select-variedad', maestros.variedades);
    llenarSelect('select-finca', maestros.fincas);
    llenarSelect('select-flete', maestros.fletes);

    llenarSelect('select-plan-productor', maestros.productores);
    llenarSelect('select-plan-variedad', maestros.variedades);

    llenarSelectOperadores('input-op-ingreso');
    llenarSelectOperadores('salida-input-op');
    llenarSelectOperadores('edit-admin-op-ingreso');
    llenarSelectOperadores('edit-admin-op-salida', true);

    llenarSelect('edit-admin-productor', maestros.productores);
    llenarSelect('edit-admin-variedad', maestros.variedades);
    llenarSelect('edit-admin-finca', maestros.fincas);
    llenarSelect('edit-admin-flete', maestros.fletes);
}

function llenarSelect(id, lista) {
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = '<option value="">-- SELECCIONAR --</option>';
    if (Array.isArray(lista)) {
        lista.forEach(item => {
            el.innerHTML += `<option value="${item}">${item}</option>`;
        });
    }
}

function llenarSelectOperadores(id, opcional = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = opcional ? '<option value="">-- NINGUNO --</option>' : '<option value="">-- SELECCIONAR OPERADOR --</option>';
    operadores.forEach(op => {
        el.innerHTML += `<option value="${op.nombre}">${op.nombre}</option>`;
    });
}

function actualizarProximoViajeBadge() {
    const prox = viajes.length + 1;
    const badge = document.getElementById('badge-proximo-viaje');
    if (badge) badge.innerText = `Próximo Viaje N°: ${String(prox).padStart(6, '0')}`;
}

function formatearRemitoEspecial(input) {
    let val = input.value.trim();
    if (!val) return;
    if (val.includes('-')) {
        let partes = val.split('-');
        if (partes.length === 2) {
            let p1 = partes[0].replace(/\D/g, '').padStart(4, '0');
            let p2 = partes[1].replace(/\D/g, '').padStart(8, '0');
            input.value = `R-${p1}-${p2}`;
        }
    }
}

async function iniciarCamara() {
    const video = document.getElementById('webcam-video');
    if (!video) return;
    
    if (streamCamara) {
        streamCamara.getTracks().forEach(track => track.stop());
        streamCamara = null;
    }

    try {
        const constraints = {
            video: { 
                facingMode: modoCamaraActual,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        streamCamara = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = streamCamara;
    } catch (err) {
        try {
            streamCamara = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = streamCamara;
        } catch (errorBasic) {
            console.error("Error al acceder a la cámara:", errorBasic);
        }
    }
}

function cambiarCamara() {
    modoCamaraActual = (modoCamaraActual === "user") ? "environment" : "user";
    iniciarCamara();
}

function capturarFoto() {
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('photo-canvas');
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 200;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    fotoBase64Capturada = canvas.toDataURL('image/jpeg', 0.7);
    video.classList.add('hidden');
    canvas.classList.remove('hidden');
}

function reiniciarCamara() {
    fotoBase64Capturada = "";
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('photo-canvas');
    if (video) video.classList.remove('hidden');
    if (canvas) canvas.classList.add('hidden');
}

function verFotoModal(fotoBase64) {
    if (!fotoBase64) return;
    const img = document.getElementById('img-modal-preview');
    const modal = document.getElementById('modal-ver-foto');
    if (img && modal) {
        img.src = fotoBase64;
        modal.classList.remove('hidden');
    }
}

function guardarNuevoIngreso(e) {
    if (e) e.preventDefault();
    ejecutarGuardarNuevoIngreso();
}

async function ejecutarGuardarNuevoIngreso() {
    const lagar = document.getElementById('select-lagar-operativo')?.value || '';
    const cantPersonas = document.getElementById('input-cant-personas-lagar')?.value || 1;

    const nuevoViaje = {
        id: String(viajes.length + 1).padStart(6, '0'),
        estado: 'EN PLANTA',
        fechaEntrada: new Date().toISOString(),
        fechaSalida: null,
        productor: document.getElementById('select-productor')?.value || '',
        variedad: document.getElementById('select-variedad')?.value || '',
        tipoProducto: document.getElementById('select-tipo-producto')?.value || 'TRADICIONAL',
        nivelCalidad: '',
        destino: document.getElementById('select-destino')?.value || '',
        finca: document.getElementById('select-finca')?.value || '',
        cuartel: document.getElementById('input-cuartel')?.value.toUpperCase() || 'S/D',
        anio: document.getElementById('input-anio')?.value || '2027',
        color: document.getElementById('select-color')?.value || '',
        cosecha: document.getElementById('select-cosecha')?.value || '',
        estadoSanitario: document.getElementById('select-estado-sanitario')?.value || '',
        flete: document.getElementById('select-flete')?.value || '',
        tipoCamion: document.getElementById('select-tipo-camion')?.value || '',
        patente: document.getElementById('input-patente')?.value.toUpperCase() || '',
        chofer: document.getElementById('input-chofer')?.value.toUpperCase() || '',
        bruto: parseFloat(document.getElementById('input-bruto')?.value) || 0,
        tara: 0,
        neto: 0,
        ot: '',
        az: '',
        remito: document.getElementById('input-remito')?.value || '',
        opIngreso: document.getElementById('input-op-ingreso')?.value || '',
        lagarOperativo: '',
    cantPersonasLagar: 0, 
        opSalida: '',
        observacionesIngreso: document.getElementById('input-observaciones')?.value.toUpperCase() || '',
        observacionesSalida: '',
        foto: fotoBase64Capturada
    };

    viajes.push(nuevoViaje);
    await guardarStorageViajes();

    alert(`✅ Viaje N° ${nuevoViaje.id} Ingresado Correctamente`);
    const form = document.getElementById('form-nuevo-ingreso');
    if (form) form.reset();
    reiniciarCamara();
    actualizarDashboard();
    actualizarProximoViajeBadge();
    mostrarPantalla('pantalla-planta');
}

function obtenerFechaValida(fechaRaw) {
    if (!fechaRaw) return null;
    let d = new Date(fechaRaw);
    if (!isNaN(d.getTime())) return d;
    return null;
}

function formatearHora(date) {
    let hrs = date.getHours().toString().padStart(2, '0');
    let mins = date.getMinutes().toString().padStart(2, '0');
    return `${hrs}:${mins}`;
}

function formatearFechaCompleta(date) {
    return date.toLocaleDateString('es-AR') + ' ' + formatearHora(date);
}

function calcularTextoTiempo(diffMs) {
    let minTotales = Math.floor(diffMs / (1000 * 60));
    let hrs = Math.floor(minTotales / 60);
    let mins = minTotales % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
}

function renderizarPlanta() {
    const tbody = document.getElementById('tbody-planta');
    if (!tbody) return;
    tbody.innerHTML = '';

    const enPlanta = viajes.filter(v => v.estado === 'EN PLANTA');

    if (enPlanta.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; color: var(--text-muted, #666);">No hay camiones en planta actualmente.</td></tr>';
        return;
    }

    enPlanta.forEach(v => {
        const fechaObj = obtenerFechaValida(v.fechaEntrada);
        let tiempoTexto = "En proceso...";
        let esExceso = false;

        if (fechaObj) {
            const diffMs = Date.now() - fechaObj.getTime();
            const hrs = diffMs / (1000 * 60 * 60);
            esExceso = hrs >= 2;
            tiempoTexto = calcularTextoTiempo(diffMs);
        }

        const tr = document.createElement('tr');
        if (esExceso) tr.classList.add('row-exceso-tiempo');

        const btnBloqueadoAttr = rolActual === 'CONSULTA' ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : '';

        tr.innerHTML = `
            <td><strong>${v.id}</strong></td>
            <td>${fechaObj ? formatearHora(fechaObj) : 'Sin Hora'}</td>
            <td><span class="badge-time ${esExceso ? 'badge-time-danger' : ''}">${tiempoTexto}</span></td>
            <td>${v.productor}</td>
            <td>${v.variedad}</td>
            <td><strong>${v.tipoProducto || 'TRADICIONAL'}</strong></td>
            <td><span class="badge-time">${v.destino || 'VINO'}</span></td>
            <td>${v.patente}</td>
            <td>${v.chofer}</td>
            <td>${v.bruto ? v.bruto.toLocaleString() : '0'} Kg</td>
            <td>${v.foto ? `<button class="btn btn-secondary btn-sm" onclick="verFotoModal('${v.foto}')">📷 Ver</button>` : 'Sin Foto'}</td>
            <td>
                <button class="btn btn-primary btn-sm" ${btnBloqueadoAttr} onclick="abrirModalSalida('${v.id}')">Finalizar Viaje</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function actualizarTiemposPermanencia() {
    const pPlanta = document.getElementById('pantalla-planta');
    if (pPlanta && !pPlanta.classList.contains('hidden')) {
        renderizarPlanta();
    }
}

function abrirModalSalida(id) {
    ejecutarAbrirModalSalida(id);
}

function ejecutarAbrirModalSalida(id) {
    const v = viajes.find(item => item.id === id);
    if (!v) return;

    document.getElementById('salida-id-viaje').value = v.id;
    document.getElementById('salida-remito').innerText = v.remito;
    document.getElementById('salida-productor').innerText = v.productor;
    document.getElementById('salida-variedad').innerText = v.variedad;
    if (document.getElementById('salida-tipo-producto')) document.getElementById('salida-tipo-producto').innerText = v.tipoProducto || 'TRADICIONAL';
    document.getElementById('salida-destino').innerText = v.destino || 'VINO';
    document.getElementById('salida-cosecha').innerText = v.cosecha;
    document.getElementById('salida-flete').innerText = v.flete;
    document.getElementById('salida-bruto').innerText = v.bruto ? v.bruto.toLocaleString() : '0';

    document.getElementById('salida-input-calidad').value = v.nivelCalidad || '';
    document.getElementById('salida-input-tara').value = v.tara || '';
    document.getElementById('salida-input-ot').value = v.ot || '';
    document.getElementById('salida-input-az').value = v.az || '';
    document.getElementById('salida-input-obs').value = '';
    document.getElementById('salida-input-lagar').value = v.lagarOperativo || '';
document.getElementById('salida-input-personas').value = v.cantPersonasLagar || '';

    calcularNetoEnVivo();

    document.getElementById('modal-salida').classList.remove('hidden');
}

function calcularNetoEnVivo() {
    const brutoRaw = document.getElementById('salida-bruto').innerText.replace(/\./g, '').replace(/,/g, '');
    const bruto = parseFloat(brutoRaw) || 0;
    const tara = parseFloat(document.getElementById('salida-input-tara').value) || 0;
    const neto = bruto - tara;
    document.getElementById('salida-input-neto').value = neto > 0 ? `${neto.toLocaleString()} KG` : '0 KG';
}

async function confirmarSalidaViaje() {
    const id = document.getElementById('salida-id-viaje').value;
    const opSalida = document.getElementById('salida-input-op').value;
    const calidad = document.getElementById('salida-input-calidad').value;
    const lagar = document.getElementById('salida-input-lagar').value;
    const personas = parseInt(document.getElementById('salida-input-personas').value) || 0;
    const tara = parseFloat(document.getElementById('salida-input-tara').value);
    const ot = document.getElementById('salida-input-ot').value.trim();
    const az = document.getElementById('salida-input-az').value.trim();

    if (!opSalida) { alert("Seleccione el Operador de Salida."); return; }
    if (!lagar) { alert("Seleccione el Lagar Operativo."); return; }
    if (personas <= 0) { alert("Ingrese la cantidad de personas en el lagar."); return; }
    if (!calidad) { alert("Seleccione el Nivel de Calidad."); return; }
    if (isNaN(tara) || tara <= 0) { alert("Ingrese una Tara válida."); return; }
    if (!ot) { alert("Ingrese el valor de OT."); return; }
    if (!az) { alert("Ingrese el valor de AZ."); return; }

    const idx = viajes.findIndex(item => item.id === id);
    if (idx !== -1) {
        viajes[idx].estado = 'FINALIZADO';
        viajes[idx].fechaSalida = new Date().toISOString();
        viajes[idx].opSalida = opSalida;
        viajes[idx].lagarOperativo = lagar;
        viajes[idx].cantPersonasLagar = personas;
        viajes[idx].nivelCalidad = calidad;
        viajes[idx].tara = tara;
        viajes[idx].neto = viajes[idx].bruto - tara;
        viajes[idx].ot = ot.toUpperCase();
        viajes[idx].az = az.toUpperCase();
        viajes[idx].observacionesSalida = document.getElementById('salida-input-obs').value.toUpperCase();

        await guardarStorageViajes();

        cerrarModal('modal-salida');
        actualizarDashboard();
        renderizarPlanta();
        renderizarFinalizados();
        abrirTicketPreview(viajes[idx]);
    }
}

function renderizarFinalizados() {
    const tbody = document.getElementById('tbody-finalizados');
    if (!tbody) return;
    tbody.innerHTML = '';

    const fin = viajes.filter(v => v.estado === 'FINALIZADO');

    if (fin.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; color: var(--text-muted, #666);">No hay viajes finalizados registrados.</td></tr>';
        actualizarPlacaAnalitica([]);
        return;
    }

    fin.forEach(v => {
        const feObj = obtenerFechaValida(v.fechaEntrada);
        const fsObj = obtenerFechaValida(v.fechaSalida);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${v.id}</strong></td>
            <td>E: ${feObj ? formatearHora(feObj) : '-'}<br>S: ${fsObj ? formatearHora(fsObj) : '-'}</td>
            <td>${v.productor}</td>
            <td>${v.variedad}</td>
            <td><strong>${v.tipoProducto || 'TRADICIONAL'}</strong></td>
            <td><span class="badge-time">${v.nivelCalidad || 'S/D'}</span></td>
            <td>${v.destino || 'VINO'}</td>
            <td>${v.patente}</td>
            <td>${v.bruto ? v.bruto.toLocaleString() : '0'}</td>
            <td>${v.tara ? v.tara.toLocaleString() : '0'}</td>
            <td><strong>${v.neto ? v.neto.toLocaleString() : '0'} Kg</strong></td>
            <td>${v.remito}</td>
            <td>${v.foto ? `<button class="btn btn-secondary btn-sm" onclick="verFotoModal('${v.foto}')">📷 Ver</button>` : 'Sin Foto'}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="imprimirTicketDirecto('${v.id}')">🎫 Ticket</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    actualizarPlacaAnalitica(fin);
}

function filtrarFinalizados() {
    const val = document.getElementById('input-buscar-finalizados').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#tbody-finalizados tr');

    rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(val) ? '' : 'none';
    });
}

function actualizarDashboard() {
    const enPlanta = viajes.filter(v => v.estado === 'EN PLANTA').length;
    const finalizados = viajes.filter(v => v.estado === 'FINALIZADO').length;

    const elPlanta = document.getElementById('dash-en-planta');
    const elFin = document.getElementById('dash-finalizados');
    const elTot = document.getElementById('dash-total');

    if (elPlanta) elPlanta.innerText = enPlanta;
    if (elFin) elFin.innerText = finalizados;
    if (elTot) elTot.innerText = viajes.length;
}

function actualizarPlacaAnalitica(finalizados) {
    let totKg = 0;
    let propKg = 0;
    let tercKg = 0;
    let porVariedad = {};
    let porProdVar = {};
    let porLagar = {};
    let obsList = [];

    // Estructuras de acumulación temporal (Día / Semana / Mes)
    let porDiaUltimos7 = {};
    let porSemanaMes = {};
    let porMes = {};

    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);

    finalizados.forEach(v => {
        const kg = v.neto || 0;
        totKg += kg;

        if (esProductorPropio(v.productor, v.finca)) {
            propKg += kg;
        } else {
            tercKg += kg;
        }

        porVariedad[v.variedad] = (porVariedad[v.variedad] || 0) + kg;

        const keyPV = `${v.productor} - ${v.variedad}`;
        porProdVar[keyPV] = (porProdVar[keyPV] || 0) + kg;

        const lagar = v.lagarOperativo || 'LAGAR 1';
        if (!porLagar[lagar]) porLagar[lagar] = { kg: 0, viajes: 0, personas: 0 };
        porLagar[lagar].kg += kg;
        porLagar[lagar].viajes += 1;
        porLagar[lagar].personas = v.cantPersonasLagar || porLagar[lagar].personas;

        if (v.observacionesIngreso && v.observacionesIngreso !== 'SIN OBSERVACIONES') {
            obsList.push(`Viaje ${v.id}: ${v.observacionesIngreso}`);
        }
        if (v.observacionesSalida && v.observacionesSalida !== 'SIN OBSERVACIONES') {
            obsList.push(`Viaje ${v.id} (Salida): ${v.observacionesSalida}`);
        }

        // --- CÁLCULO Y AGRUPACIÓN TEMPORAL (Kg por Día, Semana y Mes) ---
        const fechaStr = v.fechaSalida || v.fechaEntrada || v.fecha;
        if (fechaStr) {
            const fechaObj = typeof obtenerFechaValida === 'function' ? obtenerFechaValida(fechaStr) : new Date(fechaStr);
            if (fechaObj && !isNaN(fechaObj.getTime())) {
                // 1. Acumulado Mensual
                const mesNombre = fechaObj.toLocaleString('es-AR', { month: 'long', year: 'numeric' }).toUpperCase();
                porMes[mesNombre] = (porMes[mesNombre] || 0) + kg;

                // 2. Acumulado Diario (últimos 7 días)
                if (fechaObj >= hace7Dias) {
                    const diaClave = fechaObj.toLocaleDateString('es-AR');
                    porDiaUltimos7[diaClave] = (porDiaUltimos7[diaClave] || 0) + kg;
                }

                // 3. Acumulado Semanal del Mes
                const diaDelMes = fechaObj.getDate();
                let numSemana = "Semana 1 (Días 1-7)";
                if (diaDelMes > 21) numSemana = "Semana 4+ (Días 22+)";
                else if (diaDelMes > 14) numSemana = "Semana 3 (Días 15-21)";
                else if (diaDelMes > 7) numSemana = "Semana 2 (Días 8-14)";

                const claveSemana = `${mesNombre} - ${numSemana}`;
                porSemanaMes[claveSemana] = (porSemanaMes[claveSemana] || 0) + kg;
            }
        }
    });

    const elTot = document.getElementById('placa-kilos-totales');
    const elProp = document.getElementById('placa-kilos-propios');
    const elTerc = document.getElementById('placa-kilos-terceros');

    if (elTot) elTot.innerText = `${totKg.toLocaleString()} Kg`;
    if (elProp) elProp.innerText = `${propKg.toLocaleString()} Kg`;
    if (elTerc) elTerc.innerText = `${tercKg.toLocaleString()} Kg`;

    const elVar = document.getElementById('placa-variedades-list');
    if (elVar) {
        let html = '';
        for (let varName in porVariedad) {
            html += `<div><strong>${varName}:</strong> ${porVariedad[varName].toLocaleString()} Kg</div>`;
        }
        elVar.innerHTML = html || 'Sin datos';
    }

    const elPV = document.getElementById('placa-productores-list');
    if (elPV) {
        let html = '';
        const listaOrdenada = Object.keys(porProdVar).sort((a, b) => {
            return a.localeCompare(b, 'es', { sensitivity: 'base' });
        });

        listaOrdenada.forEach(pv => {
            const [p, v] = pv.split(' - ');
            const plan = planificaciones.find(pl => pl.productor === p && pl.variedad === v);
            const kgPlan = plan ? plan.kgPactados : 0;
            const pct = kgPlan > 0 ? ((porProdVar[pv] / kgPlan) * 100).toFixed(1) + '%' : 'N/A';
            html += `<div><strong>${pv}:</strong> ${porProdVar[pv].toLocaleString()} Kg / Plan: ${kgPlan ? kgPlan.toLocaleString() : '0'} Kg (${pct})</div>`;
        });

        elPV.innerHTML = html || 'Sin datos';
    }

    const elLag = document.getElementById('placa-lagares-list');
    if (elLag) {
        let html = '';
        for (let l in porLagar) {
            html += `<div><strong>${l}:</strong> ${porLagar[l].kg.toLocaleString()} Kg (${porLagar[l].viajes} viajes) - Personal: ${porLagar[l].personas} pers.</div>`;
        }
        elLag.innerHTML = html || 'Sin datos';
    }

    const elObs = document.getElementById('placa-observaciones-list');
    if (elObs) {
        elObs.innerHTML = obsList.length > 0 ? obsList.map(o => `<div>• ${o}</div>`).join('') : 'Sin observaciones registradas';
    }

    // RENDERIZADO DEL NUEVO PANEL DE TIEMPOS (Día / Semana / Mes)
    const elTiempos = document.getElementById('placa-tiempos-list');
    if (elTiempos) {
        let htmlTiempos = '<strong>📅 Últimos 7 Días:</strong><br>';
        const diasKeys = Object.keys(porDiaUltimos7);
        if (diasKeys.length > 0) {
            diasKeys.forEach(d => {
                htmlTiempos += `<div>• ${d}: <b>${porDiaUltimos7[d].toLocaleString()} Kg</b></div>`;
            });
        } else {
            htmlTiempos += `<div style="color:var(--text-muted);">- Sin registros recientes -</div>`;
        }

        htmlTiempos += '<br><strong>📅 Acumulado por Semana:</strong><br>';
        const semanasKeys = Object.keys(porSemanaMes);
        if (semanasKeys.length > 0) {
            semanasKeys.forEach(s => {
                htmlTiempos += `<div>• ${s}: <b>${porSemanaMes[s].toLocaleString()} Kg</b></div>`;
            });
        } else {
            htmlTiempos += `<div style="color:var(--text-muted);">- Sin registros semanales -</div>`;
        }

        htmlTiempos += '<br><strong>📅 Acumulado Mensual:</strong><br>';
        const mesesKeys = Object.keys(porMes);
        if (mesesKeys.length > 0) {
            mesesKeys.forEach(m => {
                htmlTiempos += `<div>• ${m}: <b>${porMes[m].toLocaleString()} Kg</b></div>`;
            });
        } else {
            htmlTiempos += `<div style="color:var(--text-muted);">- Sin registros mensuales -</div>`;
        }

        elTiempos.innerHTML = htmlTiempos;
    }
}

function esProductorPropio(productor, finca) {
    if (!productor) return false;
    const pUpper = productor.toUpperCase();
    if (pUpper.includes("SALENTEIN") || pUpper.includes("PORTILLO")) return true;
    if (finca && FINCAS_PROPIAS.includes(finca.toUpperCase())) return true;
    return false;
}

function abrirTicketPreview(v) {
    const feObj = obtenerFechaValida(v.fechaEntrada);
    const fsObj = obtenerFechaValida(v.fechaSalida);

    document.getElementById('tk-viaje').innerText = v.id;
    document.getElementById('tk-fecha').innerText = feObj ? feObj.toLocaleDateString('es-AR') : '-';
    document.getElementById('tk-hora-entrada').innerText = feObj ? formatearHora(feObj) : '-';
    document.getElementById('tk-hora-salida').innerText = fsObj ? formatearHora(fsObj) : '-';

    document.getElementById('tk-op-ingreso').innerText = v.opIngreso || '-';
    document.getElementById('tk-op-salida').innerText = v.opSalida || '-';
    document.getElementById('tk-remito').innerText = v.remito || '-';

    document.getElementById('tk-productor').innerText = v.productor || '-';
    document.getElementById('tk-variedad').innerText = v.variedad || '-';
    if (document.getElementById('tk-tipo-producto')) document.getElementById('tk-tipo-producto').innerText = v.tipoProducto || 'TRADICIONAL';
    document.getElementById('tk-finca').innerText = v.finca || '-';
    document.getElementById('tk-cuartel').innerText = v.cuartel || '-';
    document.getElementById('tk-anio').innerText = v.anio || '-';
    document.getElementById('tk-color').innerText = v.color || '-';
    document.getElementById('tk-cosecha').innerText = v.cosecha || '-';

    document.getElementById('tk-flete').innerText = v.flete || '-';
    document.getElementById('tk-tipo-camion').innerText = v.tipoCamion || '-';
    document.getElementById('tk-patente').innerText = v.patente || '-';
    document.getElementById('tk-chofer').innerText = v.chofer || '-';

    document.getElementById('tk-bruto').innerText = v.bruto ? v.bruto.toLocaleString() : '0';
    document.getElementById('tk-tara').innerText = v.tara ? v.tara.toLocaleString() : '0';
    document.getElementById('tk-neto').innerText = v.neto ? v.neto.toLocaleString() : '0';

    let obsCombined = [];
    if (v.observacionesIngreso) obsCombined.push(`ING: ${v.observacionesIngreso}`);
    if (v.observacionesSalida) obsCombined.push(`SAL: ${v.observacionesSalida}`);
    document.getElementById('tk-observaciones').innerText = obsCombined.length > 0 ? obsCombined.join(' | ') : 'SIN OBSERVACIONES';

    document.getElementById('modal-ticket-preview').classList.remove('hidden');
}

function imprimirTicketDirecto(id) {
    const v = viajes.find(item => item.id === id);
    if (v) abrirTicketPreview(v);
}

// --- MÓDULO ADMINISTRACIÓN ---
function autenticarAdmin() {
    const pass = document.getElementById('admin-pass-input').value.trim();
    const esValido = typeof validarAdministrador === 'function' ? validarAdministrador(pass) : (pass === 'admin123');

    if (esValido) {
        adminAutenticado = true;
        document.getElementById('admin-login-box').classList.add('hidden');
        document.getElementById('admin-content-box').classList.remove('hidden');
        document.getElementById('btn-cerrar-sesion').classList.remove('hidden');
        renderizarAdmin();
    } else {
        alert("❌ Contraseña de Administrador incorrecta.");
    }
}

function cerrarSesionAdmin() {
    adminAutenticado = false;
    document.getElementById('admin-pass-input').value = '';
    document.getElementById('admin-login-box').classList.remove('hidden');
    document.getElementById('admin-content-box').classList.add('hidden');
    document.getElementById('btn-cerrar-sesion').classList.add('hidden');
}

function renderizarAdmin() {
    renderizarOperadoresAdmin();
    renderizarGestionMaestra();
    renderizarPlanificacionesAdmin();
    renderizarEdicionViajesAdmin();
    renderizarLogReinicios();
}

function renderizarOperadoresAdmin() {
    const tbody = document.getElementById('tbody-operadores-admin');
    if (!tbody) return;
    tbody.innerHTML = '';

    operadores.forEach(op => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>OPERADOR ${op.id}</strong></td>
            <td><input type="text" class="form-control" value="${op.nombre}" onchange="actualizarOperador(${op.id}, 'nombre', this.value)"></td>
            <td><input type="text" class="form-control" value="${op.pass}" onchange="actualizarOperador(${op.id}, 'pass', this.value)"></td>
            <td style="text-align: right;"><span style="color: var(--accent-green); font-size: 0.8rem; font-weight: bold;">✔ Activo</span></td>
        `;
        tbody.appendChild(tr);
    });
}

async function actualizarOperador(id, campo, valor) {
    const idx = operadores.findIndex(o => o.id === id);
    if (idx !== -1) {
        operadores[idx][campo] = valor.trim().toUpperCase();
        await guardarStorageCompleto();
        inicializarSelects();
    }
}

function renderizarGestionMaestra() {
    const cat = document.getElementById('select-cat-maestra').value;
    const tbody = document.getElementById('tbody-maestro-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const lista = maestros[cat] || [];
    lista.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item}</td>
            <td style="text-align: right;">
                <button class="btn btn-danger btn-sm" onclick="eliminarElementoMaestro('${cat}', ${index})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function agregarElementoMaestro() {
    const cat = document.getElementById('select-cat-maestra').value;
    const input = document.getElementById('input-nuevo-maestro');
    const val = input.value.trim().toUpperCase();

    if (!val) { alert("Ingrese un valor para agregar."); return; }

    if (!maestros[cat]) maestros[cat] = [];
    if (!maestros[cat].includes(val)) {
        maestros[cat].push(val);
        await guardarStorageCompleto();
        input.value = '';
        renderizarGestionMaestra();
        inicializarSelects();
    } else {
        alert("El elemento ya existe en la lista.");
    }
}

async function eliminarElementoMaestro(cat, index) {
    if (confirm("¿Desea eliminar este elemento de las tablas maestras?")) {
        maestros[cat].splice(index, 1);
        await guardarStorageCompleto();
        renderizarGestionMaestra();
        inicializarSelects();
    }
}

function renderizarPlanificacionesAdmin() {
    const tbody = document.getElementById('tbody-planificacion-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (planificaciones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted, #666);">No hay planificaciones de kilos cargadas.</td></tr>';
        return;
    }

    planificaciones.forEach((p, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.productor}</td>
            <td>${p.variedad}</td>
            <td><strong>${p.kgPactados ? p.kgPactados.toLocaleString() : '0'} Kg</strong></td>
            <td style="text-align: right;">
                <button class="btn btn-danger btn-sm" onclick="eliminarPlanificacion(${index})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function guardarPlanificacionKg() {
    const prod = document.getElementById('select-plan-productor').value;
    const varName = document.getElementById('select-plan-variedad').value;
    const kg = parseFloat(document.getElementById('input-plan-kg').value);

    if (!prod || !varName || isNaN(kg) || kg <= 0) {
        alert("Seleccione Productor, Variedad e ingrese una cantidad de kilos válida.");
        return;
    }

    const idx = planificaciones.findIndex(p => p.productor === prod && p.variedad === varName);
    if (idx !== -1) {
        planificaciones[idx].kgPactados = kg;
    } else {
        planificaciones.push({ productor: prod, variedad: varName, kgPactados: kg });
    }

    await guardarStorageCompleto();
    document.getElementById('input-plan-kg').value = '';
    renderizarPlanificacionesAdmin();
    actualizarPlacaAnalitica(viajes.filter(v => v.estado === 'FINALIZADO'));
}

async function eliminarPlanificacion(index) {
    if (confirm("¿Desea eliminar esta planificación?")) {
        planificaciones.splice(index, 1);
        await guardarStorageCompleto();
        renderizarPlanificacionesAdmin();
        actualizarPlacaAnalitica(viajes.filter(v => v.estado === 'FINALIZADO'));
    }
}

function renderizarEdicionViajesAdmin() {
    const tbody = document.getElementById('tbody-admin-edicion');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (viajes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: var(--text-muted, #666);">No hay viajes registrados para editar.</td></tr>';
        return;
    }

    viajes.forEach(v => {
        const feObj = obtenerFechaValida(v.fechaEntrada);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${v.id}</strong></td>
            <td><span class="badge-time">${v.estado}</span></td>
            <td>${feObj ? feObj.toLocaleDateString('es-AR') : '-'}</td>
            <td>${v.productor}</td>
            <td>${v.variedad}</td>
            <td>${v.destino || 'VINO'}</td>
            <td>${v.patente}</td>
            <td>${v.remito}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="abrirModalEdicionAdmin('${v.id}')">✏️ Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalEdicionAdmin(id) {
    const v = viajes.find(item => item.id === id);
    if (!v) return;

    document.getElementById('edit-admin-id-label').innerText = v.id;
    document.getElementById('edit-admin-id').value = v.id;

    document.getElementById('edit-admin-productor').value = v.productor || '';
    document.getElementById('edit-admin-variedad').value = v.variedad || '';
    if (document.getElementById('edit-admin-tipo-producto')) document.getElementById('edit-admin-tipo-producto').value = v.tipoProducto || 'TRADICIONAL';
    document.getElementById('edit-admin-calidad').value = v.nivelCalidad || '';
    document.getElementById('edit-admin-destino').value = v.destino || 'VINO';
    document.getElementById('edit-admin-finca').value = v.finca || '';
    document.getElementById('edit-admin-cuartel').value = v.cuartel || '';
    document.getElementById('edit-admin-anio').value = v.anio || '2027';
    document.getElementById('edit-admin-color').value = v.color || 'TINTO';
    document.getElementById('edit-admin-cosecha').value = v.cosecha || 'MANUAL';
    document.getElementById('edit-admin-estado-sanitario').value = v.estadoSanitario || 'BUENO';
    document.getElementById('edit-admin-flete').value = v.flete || '';
    document.getElementById('edit-admin-tipo-camion').value = v.tipoCamion || 'VOLQUETE';
    document.getElementById('edit-admin-patente').value = v.patente || '';
    document.getElementById('edit-admin-chofer').value = v.chofer || '';
    document.getElementById('edit-admin-remito').value = v.remito || '';
    document.getElementById('edit-admin-op-ingreso').value = v.opIngreso || '';
    document.getElementById('edit-admin-op-salida').value = v.opSalida || '';
    document.getElementById('edit-admin-lagar-operativo').value = v.lagarOperativo || 'LAGAR 1';
    document.getElementById('edit-admin-cant-personas').value = v.cantPersonasLagar || 1;
    document.getElementById('edit-admin-bruto').value = v.bruto || 0;
    document.getElementById('edit-admin-tara').value = v.tara || 0;
    document.getElementById('edit-admin-neto').value = v.neto || 0;
    document.getElementById('edit-admin-ot').value = v.ot || '';
    document.getElementById('edit-admin-az').value = v.az || '';
    document.getElementById('edit-admin-estado').value = v.estado || 'EN PLANTA';
    document.getElementById('edit-admin-obs-ingreso').value = v.observacionesIngreso || '';
    document.getElementById('edit-admin-obs-salida').value = v.observacionesSalida || '';

    document.getElementById('modal-editar-admin').classList.remove('hidden');
}

function calcularNetoEdicionEnVivo() {
    const bruto = parseFloat(document.getElementById('edit-admin-bruto').value) || 0;
    const tara = parseFloat(document.getElementById('edit-admin-tara').value) || 0;
    document.getElementById('edit-admin-neto').value = bruto - tara;
}

async function guardarEdicionAdmin() {
    const id = document.getElementById('edit-admin-id').value;
    const idx = viajes.findIndex(item => item.id === id);

    if (idx !== -1) {
        viajes[idx].productor = document.getElementById('edit-admin-productor').value;
        viajes[idx].variedad = document.getElementById('edit-admin-variedad').value;
        if (document.getElementById('edit-admin-tipo-producto')) viajes[idx].tipoProducto = document.getElementById('edit-admin-tipo-producto').value;
        viajes[idx].nivelCalidad = document.getElementById('edit-admin-calidad').value;
        viajes[idx].destino = document.getElementById('edit-admin-destino').value;
        viajes[idx].finca = document.getElementById('edit-admin-finca').value;
        viajes[idx].cuartel = document.getElementById('edit-admin-cuartel').value.toUpperCase();
        viajes[idx].anio = document.getElementById('edit-admin-anio').value;
        viajes[idx].color = document.getElementById('edit-admin-color').value;
        viajes[idx].cosecha = document.getElementById('edit-admin-cosecha').value;
        viajes[idx].estadoSanitario = document.getElementById('edit-admin-estado-sanitario').value;
        viajes[idx].flete = document.getElementById('edit-admin-flete').value;
        viajes[idx].tipoCamion = document.getElementById('edit-admin-tipo-camion').value;
        viajes[idx].patente = document.getElementById('edit-admin-patente').value.toUpperCase();
        viajes[idx].chofer = document.getElementById('edit-admin-chofer').value.toUpperCase();
        viajes[idx].remito = document.getElementById('edit-admin-remito').value;
        viajes[idx].opIngreso = document.getElementById('edit-admin-op-ingreso').value;
        viajes[idx].opSalida = document.getElementById('edit-admin-op-salida').value;
        viajes[idx].lagarOperativo = document.getElementById('edit-admin-lagar-operativo').value;
        viajes[idx].cantPersonasLagar = parseInt(document.getElementById('edit-admin-cant-personas').value) || 1;
        viajes[idx].bruto = parseFloat(document.getElementById('edit-admin-bruto').value) || 0;
        viajes[idx].tara = parseFloat(document.getElementById('edit-admin-tara').value) || 0;
        viajes[idx].neto = parseFloat(document.getElementById('edit-admin-neto').value) || 0;
        viajes[idx].ot = document.getElementById('edit-admin-ot').value.toUpperCase();
        viajes[idx].az = document.getElementById('edit-admin-az').value.toUpperCase();
        viajes[idx].estado = document.getElementById('edit-admin-estado').value;
        viajes[idx].observacionesIngreso = document.getElementById('edit-admin-obs-ingreso').value.toUpperCase();
        viajes[idx].observacionesSalida = document.getElementById('edit-admin-obs-salida').value.toUpperCase();

        await guardarStorageViajes();

        cerrarModal('modal-editar-admin');
        renderizarEdicionViajesAdmin();
        actualizarDashboard();
        renderizarPlanta();
        renderizarFinalizados();
        alert("✅ Viaje actualizado correctamente.");
    }
}

function iniciarProcesoReiniciar() {
    document.getElementById('input-pass-eliminar').value = '';
    document.getElementById('modal-pass-eliminar').classList.remove('hidden');
}

async function validarYEjecutarReinicio() {
    const pass = document.getElementById('input-pass-eliminar').value.trim();
    const esClaveValida = typeof validarClaveEliminacion === 'function' ? validarClaveEliminacion(pass) : (pass === 'BORRAR2026');

    if (esClaveValida) {
        viajes = [];
        logReinicios.push({
            fecha: new Date().toISOString(),
            usuario: 'ADMINISTRADOR GENERAL',
            accion: 'Formateo completo de datos de viajes a cero'
        });

        await guardarStorageCompleto();

        cerrarModal('modal-pass-eliminar');
        actualizarDashboard();
        renderizarPlanta();
        renderizarFinalizados();
        renderizarAdmin();
        actualizarProximoViajeBadge();
        alert("⚠️ Base de datos reiniciada a 0 correctamente.");
    } else {
        alert("❌ Clave de seguridad incorrecta.");
    }
}

function renderizarLogReinicios() {
    const tbody = document.getElementById('tbody-log-reinicios');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (logReinicios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-muted, #666);">No hay registros de reinicios.</td></tr>';
        return;
    }

    logReinicios.forEach(log => {
        const feObj = obtenerFechaValida(log.fecha);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${feObj ? formatearFechaCompleta(feObj) : '-'}</td>
            <td><strong>${log.usuario}</strong></td>
            <td>${log.accion}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- EXPORTACIÓN DE EXCEL ---
function exportarExcelDetalle() {
    const fin = viajes.filter(v => v.estado === 'FINALIZADO');
    if (fin.length === 0) { alert("No hay datos para exportar."); return; }

    const dataExcel = fin.map(v => {
        const fe = obtenerFechaValida(v.fechaEntrada);
        const fs = obtenerFechaValida(v.fechaSalida);
        return {
            "Viaje N°": v.id,
            "Estado": v.estado,
            "Fecha Entrada": fe ? formatearFechaCompleta(fe) : '',
            "Fecha Salida": fs ? formatearFechaCompleta(fs) : '',
            "Remito": v.remito,
            "Productor": v.productor,
            "Variedad": v.variedad,
            "Tipo Producto": v.tipoProducto || 'TRADICIONAL',
            "Nivel Calidad": v.nivelCalidad || '',
            "Destino": v.destino || 'VINO',
            "Finca": v.finca,
            "Cuartel": v.cuartel,
            "Año": v.anio,
            "Color": v.color,
            "Tipo Cosecha": v.cosecha,
            "Estado Sanitario": v.estadoSanitario,
            "Flete": v.flete,
            "Tipo Camión": v.tipoCamion,
            "Patente": v.patente,
            "Chofer": v.chofer,
            "Bruto (Kg)": v.bruto,
            "Tara (Kg)": v.tara,
            "Neto (Kg)": v.neto,
            "OT": v.ot,
            "AZ": v.az,
            "Operador Ingreso": v.opIngreso,
            "Operador Salida": v.opSalida,
            "Lagar": v.lagarOperativo,
            "Personas Lagar": v.cantPersonasLagar,
            "Obs Ingreso": v.observacionesIngreso,
            "Obs Salida": v.observacionesSalida
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle_Viajes");
    XLSX.writeFile(wb, `Ingresos_Uva_Detalle_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function exportarExcelRendimiento() {
    const fin = viajes.filter(v => v.estado === 'FINALIZADO');
    if (fin.length === 0) { alert("No hay datos para exportar."); return; }

    // ==========================================
    // 1. CÁLCULO DE MÉTRICAS PARA PLACA ANALÍTICA
    // ==========================================
    let totalViajes = fin.length;
    let totalBruto = 0;
    let totalTara = 0;
    let totalNeto = 0;
    
    let kgPropios = 0;   // Salentein / Propios
    let kgTerceros = 0;  // Terceros

    let resumenLagar = {};

    fin.forEach(v => {
        const bruto = v.bruto || 0;
        const tara = v.tara || 0;
        const neto = v.neto || 0;

        totalBruto += bruto;
        totalTara += tara;
        totalNeto += neto;

        // Distribuir Propios vs Terceros (Ajusta 'SALENTEIN' según el valor real de tu sistema)
        const prodUpper = (v.productor || '').toUpperCase();
        if (prodUpper.includes('SALENTEIN') || prodUpper.includes('PROPIO')) {
            kgPropios += neto;
        } else {
            kgTerceros += neto;
        }

        // Totalizar por Lagar de descarga
        const lagar = v.lagar || 'Sin Asignar';
        if (!resumenLagar[lagar]) resumenLagar[lagar] = { neto: 0, viajes: 0 };
        resumenLagar[lagar].neto += neto;
        resumenLagar[lagar].viajes += 1;
    });

    // Armar matriz de datos para la hoja Placa Analítica
    const datosAnalitica = [
        ["MÉTRICA ANALÍTICA DE RECEPCIÓN", "VALOR"],
        ["Total Viajes Finalizados", totalViajes],
        ["Bruto Total (Kg)", totalBruto],
        ["Tara Total (Kg)", totalTara],
        ["Neto Total Procesado (Kg)", totalNeto],
        ["Promedio Kilos/Viaje (Kg)", totalViajes > 0 ? (totalNeto / totalViajes).toFixed(2) : 0],
        ["", ""],
        ["ORIGEN DE LA UVA (KG)", ""],
        ["Kilos Propios (Salentein)", kgPropios],
        ["Kilos Terceros", kgTerceros],
        ["% Propios", totalNeto > 0 ? ((kgPropios / totalNeto) * 100).toFixed(2) + '%' : '0%'],
        ["% Terceros", totalNeto > 0 ? ((kgTerceros / totalNeto) * 100).toFixed(2) + '%' : '0%'],
        ["", ""],
        ["DESGLOSE POR LAGAR DE DESCARGA", "NETO (KG)", "CANT. VIAJES"]
    ];

    // Agregar filas de lagares
    for (let lag in resumenLagar) {
        datosAnalitica.push([`Lagar: ${lag}`, resumenLagar[lag].neto, resumenLagar[lag].viajes]);
    }

    // ==========================================
    // 2. CÁLCULO DE CUMPLIMIENTO (TU LÓGICA ORIGINAL)
    // ==========================================
    let resumenPV = {};
    fin.forEach(v => {
        const key = `${v.productor}___${v.variedad}`;
        if (!resumenPV[key]) resumenPV[key] = { bruto: 0, tara: 0, neto: 0, viajes: 0 };
        resumenPV[key].bruto += (v.bruto || 0);
        resumenPV[key].tara += (v.tara || 0);
        resumenPV[key].neto += (v.neto || 0);
        resumenPV[key].viajes += 1;
    });

    const dataExcel = [];
    for (let key in resumenPV) {
        const [prod, varName] = key.split('___');
        const plan = planificaciones.find(p => p.productor === prod && p.variedad === varName);
        const kgPactados = plan ? plan.kgPactados : 0;
        const kgNeto = resumenPV[key].neto;
        const cumplimiento = kgPactados > 0 ? ((kgNeto / kgPactados) * 100).toFixed(2) + '%' : 'N/A';

        dataExcel.push({
            "Productor": prod,
            "Variedad": varName,
            "Viajes Total": resumenPV[key].viajes,
            "Bruto Total (Kg)": resumenPV[key].bruto,
            "Tara Total (Kg)": resumenPV[key].tara,
            "Neto Total (Kg)": resumenPV[key].neto,
            "Kg Pactados / Planificados": kgPactados,
            "% Cumplimiento": cumplimiento
        });
    }

    // ==========================================
    // 3. GENERACIÓN Y DESCARGA DEL LIBRO EXCEL
    // ==========================================
    const wb = XLSX.utils.book_new();

    // Hoja 1: Placa Analítica
    const wsAnalitica = XLSX.utils.aoa_to_sheet(datosAnalitica);
    XLSX.utils.book_append_sheet(wb, wsAnalitica, "Placa Analítica");

    // Hoja 2: Cumplimiento / Entregas
    const wsRendimientos = XLSX.utils.json_to_sheet(dataExcel);
    XLSX.utils.book_append_sheet(wb, wsRendimientos, "Cumplimiento Entregas");

    // Guardar archivo con la fecha actual
    XLSX.writeFile(wb, `Rendimiento_y_Analitica_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
// --- EXPORTACIÓN DE TICKET A PDF (5 cm x 15 cm) ---
async function exportarTicketPDF() {
    const elemento = document.getElementById('ticket-content-to-pdf');
    if (!elemento) {
        alert("No se encontró el contenedor del ticket.");
        return;
    }

    const idViaje = document.getElementById('tk-viaje')?.innerText || '000000';

    try {
        // Capturar el ticket como imagen de alta resolución
        const canvas = await html2canvas(elemento, {
            scale: 3, // Mayor nitidez para texto pequeño
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;

        // Crear documento PDF con dimensiones de 50mm x 150mm (5x15 cm)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [50, 150]
        });

        // Insertar la imagen cubriendo la medida exacta de 5x15 cm
        pdf.addImage(imgData, 'PNG', 0, 0, 50, 150);

        // Descargar archivo PDF
        pdf.save(`Ticket_Viaje_${idViaje}.pdf`);
    } catch (error) {
        console.error("Error al exportar ticket a PDF:", error);
        alert("Ocurrió un error al generar el archivo PDF.");
    }
}
