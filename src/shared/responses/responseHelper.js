const success = (res, { statusCode = 200, message = "", data = {} } = {}) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const error = (res, { statusCode = 400, message = "", errors = null } = {}) => {
  return res.status(statusCode).json({ success: false, message, errors });
};

const paginated = (res, { statusCode = 200, message = "", data = [], page, limit, total } = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
};

module.exports = { success, error, paginated };
