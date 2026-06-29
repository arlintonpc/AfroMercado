const ReviewService = require("../services/review.service");

const ReviewController = {
  async crearReviewHotel(req, res, next) {
    try {
      res.status(201).json({ ok: true, data: await ReviewService.crearReviewHotel(req.usuario.id, req.body) });
    } catch (e) { next(e); }
  },

  async reviewsHotel(req, res, next) {
    try {
      res.json({ ok: true, data: await ReviewService.reviewsHotel(Number(req.params.id)) });
    } catch (e) { next(e); }
  },

  async crearReviewTour(req, res, next) {
    try {
      res.status(201).json({ ok: true, data: await ReviewService.crearReviewTour(req.usuario.id, req.body) });
    } catch (e) { next(e); }
  },

  async reviewsTour(req, res, next) {
    try {
      res.json({ ok: true, data: await ReviewService.reviewsTour(Number(req.params.id)) });
    } catch (e) { next(e); }
  },
};

module.exports = ReviewController;
