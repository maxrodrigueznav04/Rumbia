import { Expense } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { findOwnedTrip } from './trip.controller.js';

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

  if (trip) {
    await findOwnedTrip(trip, req.user._id); // 403 explicito en vez de lista vacia
    filter.trip = trip;
  }
  if (category) filter.category = category;

  const expenses = await Expense.find(filter).sort({ date: -1 });
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

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
  await findOwnedTrip(req.params.id, req.user._id);

  const [expenses, breakdown] = await Promise.all([
    Expense.find({ trip: req.params.id }).sort({ date: -1 }),
    Expense.breakdownByTrip(req.params.id),
  ]);

  res.json({
    success: true,
    data: {
      expenses,
      breakdown,
      total: Number(expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)),
    },
  });
});
