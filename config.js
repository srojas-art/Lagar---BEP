// Configuración Global y Credenciales por Defecto
const CONFIG = {
    productorPropioNombre: "BODEGA SALENTEIN SA",
    claveEliminacion: "BORRAR2026",
    adminPass: "admin123"
};

const OPERADORES_DEFECTO = [
    { id: 1, nombre: "OPERADOR 1", pass: "op123" },
    { id: 2, nombre: "OPERADOR 2", pass: "op456" },
    { id: 3, nombre: "OPERADOR 3", pass: "op789" }
];

function obtenerOperadoresGuardados() {
    const ops = localStorage.getItem('portillo_operadores');
    if (!ops) {
        localStorage.setItem('portillo_operadores', JSON.stringify(OPERADORES_DEFECTO));
        return OPERADORES_DEFECTO;
    }
    return JSON.parse(ops);
}

function guardarOperadoresConfig(nuevosOperadores) {
    localStorage.setItem('portillo_operadores', JSON.stringify(nuevosOperadores));
}

function validarAdministrador(pass) {
    return pass === CONFIG.adminPass;
}

function validarClaveEliminacion(pass) {
    return pass === CONFIG.claveEliminacion;
}