// 获取 DOM 元素
const imageInput = document.getElementById('image-input');
const qualityInput = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const previewImage = document.getElementById('preview-image');

// 更新压缩质量显示
qualityInput.addEventListener('input', () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

// 处理图片上传
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const quality = qualityInput.value / 100;

        // 设置画布大小
        canvas.width = img.width;
        canvas.height = img.height;

        // 绘制图片到画布
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 将画布内容转换为压缩后的图片
        canvas.toBlob((blob) => {
          const compressedImageUrl = URL.createObjectURL(blob);
          previewImage.src = compressedImageUrl;
        }, file.type, quality);
      };
    };
    reader.readAsDataURL(file);
  }
});

// 为确认按钮添加点击事件处理函数
const confirmButton = document.getElementById('confirm-button');
confirmButton.addEventListener('click', () => {
  // 这里可以添加确认操作的逻辑，例如发送压缩后的图片到服务器等
  alert('已确认');
});

// 为保存按钮添加点击事件处理函数
const saveButton = document.getElementById('save-button');
  saveButton.addEventListener('click', () => {
    const compressedImageUrl = previewImage.src;
    const link = document.createElement('a');
    link.href = compressedImageUrl;
    link.download = 'compressed_image.jpg';
    link.click();
  });