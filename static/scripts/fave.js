document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.like-button').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();

            const petId = button.getAttribute('href').split('/').pop();
            const heartIcon = button.querySelector('.heart-icon');
            const petCard = button.closest('.card');

            // Restart animation
            heartIcon.classList.remove('animate');
            void heartIcon.offsetWidth;
            heartIcon.classList.add('animate');

            try {
                const res = await fetch(`/fave/${petId}`);

                if (res.status === 401) {
                    window.location.href = '/login';
                    return;
                }

                const data = await res.json();

                if (data.status === 'success') {
                    if (data.favorited) {
                        heartIcon.classList.add('liked');
                    } else {
                        heartIcon.classList.remove('liked');

                        if (petCard) {
                            // Create undo element
                            const undoWrapper = document.createElement('div');
                            undoWrapper.classList.add('undo-wrapper');
                            undoWrapper.innerHTML = `
                                <div class="undo-message">
                                    Removed from favorites.
                                    <button class="undo-btn">Undo</button>
                                </div>
                            `;

                            // Replace card with undo button
                            const cardParent = petCard.parentNode;
                            cardParent.insertBefore(undoWrapper, petCard);
                            petCard.style.display = 'none';

                            // Set undo timeout
                            const undoTimeout = setTimeout(() => {
                                petCard.remove();
                                undoWrapper.remove();
                            }, 5000);

                            // Undo click handler
                            undoWrapper.querySelector('.undo-btn').addEventListener('click', async () => {
                                clearTimeout(undoTimeout);
                                undoWrapper.remove();
                                petCard.style.display = '';
                                heartIcon.classList.add('liked');

                                // Re-favorite pet
                                const undoRes = await fetch(`/fave/${petId}`);
                                const undoData = await undoRes.json();
                                if (undoData.status !== 'success') {
                                    console.error('Undo failed:', undoData.message);
                                }
                            });
                        }
                    }
                } else {
                    console.error('Error favoriting:', data.message);
                }
            } catch (err) {
                console.error('Request failed:', err);
            }
        });
    });
});
