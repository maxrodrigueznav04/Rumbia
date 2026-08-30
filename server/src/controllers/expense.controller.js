import { Expense } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { findOwnedTrip } from './trip.controller.js';
import { convertirTotales } from '../services/exchange.service.js';

async function findOwnedExpense(expenseId, userId) {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Gasto no encontrado.');
  if (String(expense.user) !== String(userId)) throw ApiError.forbidden();
  return expense;
}

/** GET /api/expenses?trip=&category= */
export const listExpenses = asyncHandler(async (req, res) => {
  const { trip, category } = req.validatedQuery;
  const filter = { user: req.user._id };

  let viaje = null;
  if (trip) {
    viaje = await findOwnedTrip(trip, req.user._id); // 403 explicito en vez de lista vacia
    filter.trip = trip;
  }
  if (category) filter.category = category;

  const expenses = await Expense.find(filter).sort({ date: -1 });

  // Sin filtro de viaje no hay una sola moneda a la cual convertir (son
  // gastos de viajes distintos, cada uno con la suya): se suma en crudo,
  // igual que antes. Con un viaje especifico si se puede convertir todo a su
  // moneda, que es lo que evita sumar USD y MXN como si fueran lo mismo.
  let total;
  if (viaje) {
    const { convertido } = await convertirTotales(
      expenses.map((e) => ({ amount: e.amount, currency: e.currency })),
      viaje.budget?.currency || 'MXN'
    );
    total = convertido.reduce((sum, e) => sum + e.convertido, 0);
  } else {
    total = expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  res.json({
    success: true,
    data: { expenses, total: Number(total.toFixed(2)), count: expenses.length },
  });
});

export const createExpense = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.body.trip, req.user._id);

  const expense = await Expense.create({
    ...req.body,
    user: req.user._id,
    currency: req.body.currency || trip.budget?.currency || 'MXN',
  });

  res.status(201).json({ success: true, message: 'Gasto agregado.', data: { expense } });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await findOwnedExpense(req.params.id, req.user._id);
  Object.assign(expense, req.body);
  await expense.save();

  res.json({ success: true, message: 'Gasto actualizado.', data: { expense } });
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await findOwnedExpense(req.params.id, req.user._id);
  await expense.deleteOne();

  res.json({ success: true, message: 'Gasto eliminado.' });
});

/** GET /api/trips/:id/expenses — atajo anidado para la vista de detalle. */
export const listTripExpenses = asyncHandler(async (req, res) => {
  const viaje = await findOwnedTrip(req.params.id, req.user._id);
  const expenses = await Expense.find({ trip: req.params.id }).sort({ date: -1 });

  // Mismo motivo que en getTripSummary: sumar en crudo mezclaba USD y MXN
  // como si fueran la misma moneda. breakdownByTrip usaba un $sum de Mongo
  // que no puede convertir, asi que el desglose por categoria se arma aqui,
  // en JS, sobre los montos ya convertidos.
  const moneda = viaje.budget?.currency || 'MXN';
  const { convertido } = await convertirTotales(
    expenses.map((e) => ({ amount: e.amount, currency: e.currency, category: e.category })),
    moneda
  );

  const porCategoria = convertido.reduce((acc, e) => {
    const actual = acc.get(e.category) || { category: e.category, total: 0, count: 0 };
    actual.total = Number((actual.total + e.convertido).toFixed(2));
    actual.count += 1;
    acc.set(e.category, actual);
    return acc;
  }, new Map());
  const breakdown = [...porCategoria.values()].sort((a, b) => b.total - a.total);

  res.json({
    success: true,
    data: {
      expenses,
      breakdown,
      total: Number(convertido.reduce((s, e) => s + e.convertido, 0).toFixed(2)),
    },
  });
});
