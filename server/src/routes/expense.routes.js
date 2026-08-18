import { Router } from 'express';
import * as ctrl from '../controllers/expense.controller.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseListQuerySchema,
} from '../validators/schemas.js';

const router = Router();

router.use(protect);

router.get('/', validate(expenseListQuerySchema, 'query'), ctrl.listExpenses);
router.post('/', validate(createExpenseSchema), ctrl.createExpense);
router.patch('/:id', validate(updateExpenseSchema), ctrl.updateExpense);
router.delete('/:id', ctrl.deleteExpense);

export default router;
