// Bundled PaymentGateway SDK
(function(){
  class PaymentGateway {
    constructor(options){
      if(!options || !options.orderId){ throw new Error('orderId is required'); }
      this.options = options;
      this.modal = null;
      this.handleMessage = this.handleMessage.bind(this);
    }
    open(){
      this.close();
      const overlay = document.createElement('div');
      overlay.id = 'payment-gateway-modal';
      overlay.setAttribute('data-test-id','payment-modal');
      overlay.style.position='fixed';
      overlay.style.top='0';
      overlay.style.left='0';
      overlay.style.width='100%';
      overlay.style.height='100%';
      overlay.style.background='rgba(0,0,0,0.4)';
      overlay.style.display='flex';
      overlay.style.alignItems='center';
      overlay.style.justifyContent='center';
      overlay.style.zIndex='9999';

      const content=document.createElement('div');
      content.className='modal-content';
      content.style.position='relative';
      content.style.width='420px';
      content.style.maxWidth='90%';
      content.style.height='80%';
      content.style.background='#fff';
      content.style.borderRadius='10px';
      content.style.boxShadow='0 10px 30px rgba(0,0,0,0.2)';
      content.style.overflow='hidden';

      const iframe=document.createElement('iframe');
      iframe.setAttribute('data-test-id','payment-iframe');
      iframe.src=`http://localhost:3001/checkout?order_id=${encodeURIComponent(this.options.orderId)}&embedded=true`;
      iframe.style.border='0';
      iframe.style.width='100%';
      iframe.style.height='100%';

      const closeBtn=document.createElement('button');
      closeBtn.setAttribute('data-test-id','close-modal-button');
      closeBtn.innerText='×';
      closeBtn.style.position='absolute';
      closeBtn.style.top='8px';
      closeBtn.style.right='10px';
      closeBtn.style.background='transparent';
      closeBtn.style.border='none';
      closeBtn.style.fontSize='24px';
      closeBtn.style.cursor='pointer';
      closeBtn.onclick=()=>this.close();

      content.appendChild(iframe);
      content.appendChild(closeBtn);
      overlay.appendChild(content);
      document.body.appendChild(overlay);
      this.modal=overlay;
      window.addEventListener('message',this.handleMessage);
    }
    handleMessage(event){
      if(event.data && event.data.type==='payment_success'){
        if(this.options.onSuccess) this.options.onSuccess(event.data.data);
        this.close();
      } else if(event.data && event.data.type==='payment_failed'){
        if(this.options.onFailure) this.options.onFailure(event.data.data);
      } else if(event.data && event.data.type==='close_modal'){
        this.close();
      }
    }
    close(){
      if(this.modal){
        window.removeEventListener('message',this.handleMessage);
        this.modal.remove();
        this.modal=null;
      }
      if(this.options.onClose) this.options.onClose();
    }
  }
  window.PaymentGateway=PaymentGateway;
})();
