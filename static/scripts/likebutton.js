document.querySelectorAll('.like-button .heart-icon').forEach(icon => {
    icon.addEventListener('click', e => {
      e.preventDefault(); // Stop immediate link navigation
      icon.classList.toggle('liked');
  
      icon.style.pointerEvents = 'none';
  
      // Wait for the animation to finish
      setTimeout(() => {
        window.location.href = icon.closest('a').href;
      }, 700);
  
      // Re-enable pointer events after animation
      setTimeout(() => {
        icon.style.pointerEvents = 'auto';
      }, 800);
    });
});