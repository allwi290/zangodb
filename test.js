function testFunction() {
    for (var index = 0; index < 10; index++) {
        if (index > 10) {
            return;
        } else {
            continue;
        }
    }
    console.info(index);
}
testFunction();