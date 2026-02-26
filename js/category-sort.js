// js/category-sort.js
document.addEventListener('DOMContentLoaded', function() {
    // ---- Для десктопных кнопок сортировки ----
    const desktopSortButtons = document.querySelectorAll('#desktop-sort .btn');

    desktopSortButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sortValue = this.dataset.sortValue; // Получаем значение из data-sort-value
            document.cookie = `category_sort_order=${sortValue}; path=/; max-age=${60 * 60 * 24 * 30}`; // Кука на 30 дней
            location.reload(); // Перезагружаем страницу
        });
    });

    // ---- Для мобильного select сортировки ----
    const mobileSortSelect = document.querySelector('#mobile-sort select[name="mobile-sort-select"]');

    if (mobileSortSelect) {
        mobileSortSelect.addEventListener('change', function() {
            const sortValue = this.value; // Получаем выбранное значение
            document.cookie = `category_sort_order=${sortValue}; path=/; max-age=${60 * 60 * 24 * 30}`; // Кука на 30 дней
            location.reload(); // Перезагружаем страницу
        });
    }
});

// Функция для работы с куками (если нужна будет более детальная работа)
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}