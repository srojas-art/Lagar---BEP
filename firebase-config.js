// Importación directa desde el CDN de Firebase mediante módulos ES
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Tus credenciales exactas extraídas de la consola
const firebaseConfig = {
  apiKey: "AIzaSyCfdvCVK0P72lC5a6SUE7rztptBhZqkJoE",
  authDomain: "lagarcontrol-bep.firebaseapp.com",
  databaseURL: "https://lagarcontrol-bep-default-rtdb.firebaseio.com", // Importante para Realtime Database
  projectId: "lagarcontrol-bep",
  storageBucket: "lagarcontrol-bep.firebasestorage.app",
  messagingSenderId: "958161450733",
  appId: "1:958161450733:web:2918260302e218ac757ee4"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Referencia al nodo donde se guardarán los ingresos de uva
const uvasRef = ref(db, 'ingresos_uva');

// 1. FUNCIÓN PARA GUARDAR UN NUEVO INGRESO (Replaza tu antigua función con localStorage)
export function guardarIngresoUva(datosIngreso) {
  const nuevoIngresoRef = push(uvasRef);
  return set(nuevoIngresoRef, datosIngreso);
}

// 2. ESCUCHAR CAMBIOS EN TIEMPO REAL
// Esta función se ejecuta automáticamente cuando arranca la app y cada vez que alguien agrega/elimina un registro
onValue(uvasRef, (snapshot) => {
  const data = snapshot.val();
  const listaIngresos = [];
  
  if (data) {
    Object.keys(data).forEach((id) => {
      listaIngresos.push({ id, ...data[id] });
    });
  }
  
  // Llama a la función que renderiza la tabla/lista en tu interfaz actual
  renderizarIngresos(listaIngresos); 
});

// 3. FUNCIÓN OPCIONAL PARA ELIMINAR UN REGISTRO
export function eliminarIngresoUva(id) {
  const registroRef = ref(db, `ingresos_uva/${id}`);
  return remove(registroRef);
}

function renderizarIngresos(ingresos) {
  // Conecta aquí la lógica que ya tienes para actualizar el HTML de tu tabla o tarjetas
  console.log("Registros actualizados desde Firebase:", ingresos);
}