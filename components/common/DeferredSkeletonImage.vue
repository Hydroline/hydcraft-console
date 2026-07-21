<script setup lang="ts">
const ready = ref(false)
onMounted(() => {
	ready.value = true
})
</script>
<template><slot v-if="ready" /><CommonSkeletonImage v-else /></template>
