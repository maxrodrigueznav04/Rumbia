import mongoose from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'transporte',
  'hospedaje',
  'transporte-local',
  'comida',
  'actividades',
  'compras',
  'otros',
];

/**
 * Gastos sueltos que el usuario agrega a mano (comida, souvenirs, entradas...).
 * Los costos de transporte/hospedaje/transporte local capturados dentro del Trip
 * NO se duplican aqui: el resumen de presupuesto suma ambas fuentes por separado.
 */
const expenseSchema = new mongoose.Schema(
  {
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, default: 'otros' },
    description: { type: String, required: true, trim: true, maxlength: 160 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, uppercase: true, minlength: 3, maxlength: 3, default: 'MXN' },
    date: { type: Date, default: Date.now },
    isPaid: { type: Boolean, default: false },
    isEstimate: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

expenseSchema.index({ trip: 1, date: -1 });

export default mongoose.model('Expense', expenseSchema);
