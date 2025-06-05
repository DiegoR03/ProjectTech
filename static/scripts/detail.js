console.log("Pet Description:", pet.description);

document.addEventListener("DOMContentLoaded", () => {
    const descElement = document.getElementById("description");
    descElement.innerText = JSON.parse(pet.description);
});