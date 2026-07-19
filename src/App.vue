<template>
  <div ref="containerRef" class="container" @click="handleContainerClick">
    <div class="header card">
      <h1>PS 图层导出工具</h1>
      <DocInfo />
    </div>

    <StatusBar :message="statusMsg" :isError="statusError" />
    <DebugPanel />
    <Toast ref="toastRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, computed, onMounted, onUnmounted } from "vue";
import DocInfo from "./components/DocInfo.vue";
import StatusBar from "./components/StatusBar.vue";
import DebugPanel from "./components/DebugPanel.vue";
import Toast from "./components/Toast.vue";

// 状态管理
const statusMsg = ref("就绪");
const statusError = ref(false);

// 响应式紧凑模式（容器宽度 < 360px 时启用简写标签）
const containerRef = ref<HTMLElement | null>(null);
const uiCompact = ref(false);
let compactObserver: ResizeObserver | null = null;
provide("uiCompact", computed(() => uiCompact.value));

function handleStatus(msg: string, isError = false) {
  statusMsg.value = msg;
  statusError.value = isError;
}

function handleContainerClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.tagName === "BUTTON" || target.closest("button")) {
    const btn = target.tagName === "BUTTON" ? target : target.closest("button");
    (btn as HTMLElement)?.blur();
  }
}

// Toast provider
const toastRef = ref<InstanceType<typeof Toast>>();
provide("showToast", (msg: string, isError = false) => {
  toastRef.value?.showToast(msg, isError);
});

onMounted(() => {
  if (containerRef.value) {
    compactObserver = new ResizeObserver(function () {
      uiCompact.value = (containerRef.value as HTMLElement).clientWidth < 360;
    });
    compactObserver.observe(containerRef.value);
    uiCompact.value = containerRef.value.clientWidth < 360;
  }
});

onUnmounted(() => {
  if (compactObserver) { compactObserver.disconnect(); compactObserver = null; }
});
</script>

<style scoped>
.header {
  margin-bottom: 0;
}

.header h1 {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.2px;
}
</style>
