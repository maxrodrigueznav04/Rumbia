import { Router } from 'express';
import validate from '../middleware/validate.js';
import * as ctrl from '../controllers/visualProposals.controller.js';
import { selectVisualTemplateSchema, updateVisualProposalSchema, issueVisualProposalSchema } from '../validators/visualTemplate.js';

const router = Router({ mergeParams: true });
router.get('/', ctrl.get);
router.post('/', validate(selectVisualTemplateSchema), ctrl.selectTemplate);
router.patch('/', validate(updateVisualProposalSchema), ctrl.update);
router.get('/preview', ctrl.preview);
router.post('/issue', validate(issueVisualProposalSchema), ctrl.issue);
router.get('/issues/:issueId/pdf', ctrl.download);

export default router;
