// Live-mode workflow bridge: approval is local authorization; posting remains mainframe-backed.
window.addEventListener('load', async () => {
  if (!MAINFRAME_MODE) return;
  const originalLoad = loadMainframeState;
  const originalRefresh = refresh;

  loadMainframeState = async () => {
    await originalLoad();
    state.expenses = state.expenses.map(x => ({
      ...x,
      status: x.status === 'pending_approval' ? 'Pending approval' :
        x.status === 'approved' ? 'Approved' : x.status
    }));
    const batches = await api('/api/batches');
    state.batches = batches.map(x => ({
      id: x.batch_id || x.request_id,
      job: 'EXPPOST / mainframe',
      submittedAt: x.created_at || '',
      status: x.status,
      inputCount: x.input_count,
      outputCount: x.posted,
      rejectedCount: x.rejected,
      returnCode: x.status === 'completed' ? 0 : '—',
      environment: 'z/OS'
    }));
  };

  refresh = async () => {
    await originalRefresh();
    ['approvals', 'batches'].forEach(name => {
      const button = document.querySelector(`button[data-page="${name}"]`);
      if (button && can(name === 'approvals' ? 'expense:approve_assigned' : 'batch:read')) {
        button.classList.remove('hidden');
      }
    });
    document.querySelector('[data-group="finance"]')?.classList.remove('hidden');
  };

  pollMainframe = async requestId => {
    const job = await api('/api/jobs/' + requestId);
    toast(`Expense status: ${job.status}`);
    return job;
  };

  document.addEventListener('click', async event => {
    const button = event.target.closest('#run-batch');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const batch = await api('/api/batches', 'POST', {});
      toast(`Mainframe batch ${batch.status}`);
      await refresh();
    } catch (error) { toast(error.message); }
  }, true);

  await refresh();
});
