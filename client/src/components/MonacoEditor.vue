<template>
    <div class="editor-container" ref="editorContainer"></div>
</template>

<script>
import * as monaco from 'monaco-editor';

export default {
    name: 'MonacoEditor',
    props: {
        value: {
            type: String,
            default: '',
        },
        language: {
            type: String,
            default: 'python',
        },
        theme: {
            type: String,
            default: 'vs-dark',
        },
    },
    data() {
        return {
            editor: null,
        };
    },
    mounted() {
        this.editor = monaco.editor.create(this.$refs.editorContainer, {
            value: this.value,
            language: this.language,
            theme: this.theme,
            automaticLayout: true,
        });
    },
    beforeUnmount() {
        if (this.editor) {
            this.editor.dispose();
        }
    },
};
</script>

<style>
.editor-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
}
</style>
