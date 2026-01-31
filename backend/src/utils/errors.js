function sendError(res, status, code, description) {
  return res.status(status).json({
    error: {
      code,
      description,
    },
  });
}

module.exports = {
  sendError,
};
