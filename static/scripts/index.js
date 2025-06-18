const menuButton = document.getElementById("menuButton")
const deNav = document.querySelector("header nav")

menuButton.onclick = toggleMenu 

function toggleMenu() {
    deNav.classList.toggle("open")
}
