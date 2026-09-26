const router = require('express').Router();
const { body, query, param } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { readLimiter, authLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const repository = require('../repositories/adminRepository');
router.use(requireAuth, requireAdmin, readLimiter);
router.get('/users', query('search').optional().isString().isLength({max:150}), query('page').optional().isInt({min:1,max:100000}), validate, asyncHandler(async (req,res) => {
  const page = Number(req.query.page || 1);
  const result = await repository.list({search:req.query.search || '', limit:20, offset:(page-1)*20});
  res.json({success:true, ...result, page, pageSize:20});
}));
router.get('/users/:id', param('id').isInt({min:1}), validate, asyncHandler(async (req,res) => {
  const user = await repository.find(req.params.id); if(!user) throw ApiError.notFound('Cadastro não encontrado.');
  res.json({success:true,user});
}));
router.patch('/users/:id/status', authLimiter, param('id').isInt({min:1}), body('status').isIn(['active','suspended']), body('confirm').equals('CONFIRMAR'), validate, asyncHandler(async (req,res) => {
  if(String(req.user.id) === req.params.id) throw ApiError.forbidden('Você não pode suspender sua própria conta.');
  const user=await repository.find(req.params.id); if(!user) throw ApiError.notFound('Cadastro não encontrado.');
  if(user.role === 'admin') throw ApiError.forbidden('Contas administrativas não podem ser suspensas por esta interface.');
  if(!await repository.setStatus(req.params.id,req.body.status)) throw ApiError.conflict('O cadastro mudou. Atualize a lista.');
  res.json({success:true,message:req.body.status === 'suspended' ? 'Conta suspensa e sessões revogadas.' : 'Conta reativada.'});
}));
module.exports=router;