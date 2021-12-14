export default (_next, num) => {
    let count = 0;

    const next = async() => {
        if (count++ < num) {
            return await _next();
        } else {
            return;
        }
    };

    return next;
};
