document.addEventListener("DOMContentLoaded", function () {
    const slider = document.querySelector('.slider');
    slider.focus();
    
    const list = document.querySelector('.slider .list');
    const items = document.querySelectorAll('.slider .list .item');
    const dots = document.querySelectorAll('.slider .dots li');
    const prev = document.getElementById('prev');
    const next = document.getElementById('next');
  
    if (items.length <= 1) return;
  
    let active = 0;
    const lengthItems = items.length;
  
    function reloadSlider() {
      const offset = items[active].offsetLeft;
      list.style.left = -offset + 'px';
  
      document.querySelector('.slider .dots li.active')?.classList.remove('active');
      dots[active]?.classList.add('active');
    }
  
    next.onclick = () => {
      active = (active + 1) % lengthItems;
      reloadSlider();
    };
  
    prev.onclick = () => {
      active = (active - 1 + lengthItems) % lengthItems;
      reloadSlider();
    };
  
    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        active = index;
        reloadSlider();
      });
    });
  
    // Keyboard navigation
    slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        next.click();
      } else if (e.key === 'ArrowLeft') {
        prev.click();
      }
    });

    // Scroll wheel function
    slider.addEventListener('wheel', (e) => {
        // Only trigger on horizontal scroll or trackpad gesture
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.preventDefault();
          if (e.deltaX > 0) {
            next.click();
          } else {
            prev.click();
          }
        }
      }, { passive: false });
});